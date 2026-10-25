/*
 * Reference implementation — adapt package/bundle ids. Original work (no code
 * taken from integrating-lynx-demo-projects); uses only Android platform APIs.
 *
 * Secure storage for the `AwcmsHostBridge` contract on Android:
 *
 *   plaintext --AES-256-GCM(key never leaves AndroidKeystore)--> Base64 --> private SharedPreferences
 *
 * WHY NOT androidx.security:security-crypto (EncryptedSharedPreferences)?
 *   Google deprecated the whole library (all public APIs). It pulls in Tink and
 *   a MasterKey abstraction, has had long-standing init crashes on some OEM
 *   keystores, and we only need "encrypt one string under a non-exportable key".
 *   That is ~60 lines of platform Keystore API with no dependency, which is
 *   easier to audit than a deprecated wrapper. The on-disk format below is our
 *   own and versioned ("v1."), so migrating later is a decode/encode loop.
 *   VERIFY: re-check the deprecation notice in the androidx.security release
 *   notes before quoting it externally.
 *
 * Threat model (see hosts/README.md for the cross-platform table):
 *   - Protects against: reading the app's data directory from a backup, an
 *     adb pull on a rooted/forensic image, another app with a stolen copy of
 *     shared_prefs/. The AES key is non-exportable, so ciphertext is useless
 *     off-device.
 *   - Does NOT protect against: code running inside our process or a rooted
 *     device actively hooking Keystore calls, a malicious bundle (the bundle
 *     can call secureStorage.get for any well-formed key), or screen overlays.
 *   - The key is NOT bound to user authentication (no biometric gate): the
 *     session must be readable at cold start in the background (push handling).
 *     Add setUserAuthenticationRequired(true) only for a step-up secret.
 *
 * Design details:
 *   - Fresh random 96-bit IV per write (Keystore generates it:
 *     setRandomizedEncryptionRequired(true) is the default and forbids reuse).
 *   - The storage key is bound as GCM AAD, so an attacker who can edit the
 *     prefs file cannot swap the ciphertext of one entry onto another key.
 *   - Entries that can no longer be decrypted because the Keystore key is gone
 *     (restore to a new device, key invalidation) are deleted and read as null:
 *     fail closed, never return anything but authenticated plaintext. Transient
 *     Keystore errors are NOT treated that way; they surface as
 *     SecureStoreException -> STORAGE_UNAVAILABLE so we never destroy data on a hiccup.
 *   - Set allowBackup="false" or exclude `awcms_lynx_secure.xml` in
 *     data_extraction_rules / fullBackupContent (hosts/android/README.md).
 */
package id.ahliweb.awcms.lynx.host

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class KeystoreSecureStore(
    context: Context,
    private val keyAlias: String = "awcms-lynx-aes-gcm-v1",
    prefsName: String = "awcms_lynx_secure",
    /**
     * StrongBox (dedicated secure element, API 28+) is slower and absent on most
     * mid-range devices. Off by default; when on, we fall back to the TEE-backed
     * key if the device throws StrongBoxUnavailableException.
     */
    private val preferStrongBox: Boolean = false,
) : SecureStore {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

    // One lock for key creation and prefs writes: module calls arrive on Lynx threads.
    private val lock = Any()

    override fun get(key: String): String? = synchronized(lock) {
        val stored = prefs.getString(key, null) ?: return null
        try {
            decrypt(key, stored)
        } catch (e: AEADBadTagException) {
            dropUndecryptable(key)
        } catch (e: KeyPermanentlyInvalidatedException) {
            dropUndecryptable(key)
        } catch (e: UnrecoverableKeyException) {
            dropUndecryptable(key)
        } catch (e: IllegalArgumentException) { // corrupt Base64 / wrong version prefix
            dropUndecryptable(key)
        } catch (e: GeneralSecurityException) {
            throw SecureStoreException("Keystore read failed", e)
        }
    }

    override fun set(key: String, value: String): Unit = synchronized(lock) {
        val encoded = try {
            encrypt(key, value)
        } catch (e: GeneralSecurityException) {
            throw SecureStoreException("Keystore write failed", e)
        }
        // commit() (not apply()) so a failed disk write is reported, not swallowed.
        if (!prefs.edit().putString(key, encoded).commit()) {
            throw SecureStoreException("Preferences commit failed")
        }
    }

    override fun delete(key: String): Unit = synchronized(lock) {
        if (!prefs.edit().remove(key).commit()) {
            throw SecureStoreException("Preferences commit failed")
        }
    }

    // --- crypto ----------------------------------------------------------------

    private fun encrypt(key: String, plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey()) // Keystore picks the random IV
        cipher.updateAAD(aad(key))
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val iv = cipher.iv
        check(iv.size == IV_BYTES) { "Unexpected GCM IV length" }
        return VERSION_PREFIX + Base64.encodeToString(iv + ciphertext, Base64.NO_WRAP)
    }

    private fun decrypt(key: String, stored: String): String {
        require(stored.startsWith(VERSION_PREFIX)) { "Unknown storage format" }
        val blob = Base64.decode(stored.removePrefix(VERSION_PREFIX), Base64.NO_WRAP)
        require(blob.size > IV_BYTES + TAG_BITS / 8) { "Truncated blob" }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            secretKey(),
            GCMParameterSpec(TAG_BITS, blob.copyOfRange(0, IV_BYTES)),
        )
        cipher.updateAAD(aad(key))
        return String(cipher.doFinal(blob, IV_BYTES, blob.size - IV_BYTES), Charsets.UTF_8)
    }

    private fun aad(key: String): ByteArray = (AAD_PREFIX + key).toByteArray(Charsets.UTF_8)

    private fun dropUndecryptable(key: String): String? {
        prefs.edit().remove(key).commit()
        return null
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        try {
            keyStore.load(null)
        } catch (e: java.io.IOException) { // surface as a GeneralSecurityException -> STORAGE_UNAVAILABLE
            throw java.security.KeyStoreException("Keystore load failed", e)
        }
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        return if (preferStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                generateKey(strongBox = true)
            } catch (e: android.security.keystore.StrongBoxUnavailableException) {
                generateKey(strongBox = false)
            }
        } else {
            generateKey(strongBox = false)
        }
    }

    private fun generateKey(strongBox: Boolean): SecretKey {
        val builder = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(builder.build())
        return generator.generateKey()
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_BYTES = 12
        private const val TAG_BITS = 128
        private const val VERSION_PREFIX = "v1."
        private const val AAD_PREFIX = "awcms-lynx/secure-store/v1|"

        @Volatile private var instance: KeystoreSecureStore? = null

        /** One store per process: the lock above only works if the instance is shared. */
        fun shared(context: Context): KeystoreSecureStore =
            instance ?: synchronized(this) {
                instance ?: KeystoreSecureStore(context).also { instance = it }
            }
    }
}
