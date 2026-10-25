/*
 * Reference implementation — adapt package/bundle ids. Original work (no code taken from
 * integrating-lynx-demo-projects); uses HarmonyOS Kits only (API 12+ style imports).
 *
 * Secure storage for the `AwcmsHostBridge` contract on HarmonyOS:
 *
 *   plaintext --AES-256-GCM (HUKS key, never leaves HUKS)--> Base64 --> @kit.ArkData Preferences
 *
 * WHY HUKS + Preferences AND NOT the Asset Store Kit (@kit.AssetStoreKit, `asset.add/query/update/remove`)?
 *   The Asset Store is HarmonyOS's purpose-built vault for short secrets (passwords, tokens), with
 *   optional lock-screen/auth binding and survive-uninstall semantics, and it is the right choice
 *   when the secret is small. Its secret size limit is about 1 KiB (VERIFY in the current Asset
 *   Store Kit reference), while the AWCMS host contract allows values up to 16384 UTF-16 units
 *   (a session object with access + refresh tokens and tenant context can exceed 1 KiB).
 *   So values are encrypted with a HUKS-held AES-GCM key and the ciphertext sits in Preferences.
 *   If the app ever stores only a refresh token (< 1 KiB) the Asset Store becomes the better fit
 *   and this class can be swapped behind the SecureStore interface without touching the module.
 *
 * Threat model (cross-platform table: hosts/README.md):
 *   - Protects against: reading the app sandbox (backup, forensic copy of the Preferences file);
 *     the HUKS key is non-exportable, so ciphertext is useless off-device.
 *   - Does NOT protect against: code in our own process, a compromised OS, or a malicious bundle
 *     (any bundle in the LynxView can call secureStorage.get for any well-formed key).
 *   - The key has no user-authentication binding (session must be readable at cold start).
 *
 * Design details:
 *   - Fresh random 96-bit nonce per write (cryptoFramework random), stored in front of the ciphertext.
 *   - The storage key is bound as GCM associated data, so ciphertext cannot be moved between keys.
 *   - If the HUKS key is gone (app data restored without the keystore) the entry is dropped and
 *     read as null: fail closed. Any other failure surfaces as SecureStoreError -> STORAGE_UNAVAILABLE
 *     and the stored data is left untouched.
 *   - Operations are serialised through a promise queue: HUKS sessions are async and Lynx may
 *     call the module concurrently.
 *   - HUKS limits one operation's input size (about 64 KiB per call — VERIFY); the contract
 *     maximum (16384 UTF-16 units = at most 48 KiB of UTF-8) fits in a single finishSession.
 */
import { huks } from '@kit.UniversalKeystoreKit';
import { preferences } from '@kit.ArkData';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { util } from '@kit.ArkTS';

export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class SecureStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecureStoreError';
  }
}

const KEY_ALIAS: string = 'awcms-lynx-aes-gcm-v1';
const PREFS_NAME: string = 'awcms_lynx_secure';
const VERSION_PREFIX: string = 'v1.';
const AAD_PREFIX: string = 'awcms-lynx/secure-store/v1|';
const NONCE_BYTES: number = 12;
const TAG_BYTES: number = 16;

export class HuksSecureStore implements SecureStore {
  private prefs: preferences.Preferences;
  private queue: Promise<void> = Promise.resolve();

  constructor(context: Context) {
    // Same call shape as the Lynx "Native Modules" guide (native-module-harmony.mdx).
    this.prefs = preferences.getPreferencesSync(context, { name: PREFS_NAME });
  }

  get(key: string): Promise<string | null> {
    return this.enqueue<string | null>(async (): Promise<string | null> => {
      const stored: string = this.prefs.getSync(key, '') as string;
      if (stored === '') {
        return null;
      }
      if (!(await this.keyExists())) {
        // The HUKS key is gone: the ciphertext can never be read again.
        this.dropEntry(key);
        return null;
      }
      if (!stored.startsWith(VERSION_PREFIX)) {
        this.dropEntry(key);
        return null;
      }
      try {
        const blob: Uint8Array = new util.Base64Helper().decodeSync(stored.substring(VERSION_PREFIX.length));
        if (blob.length <= NONCE_BYTES + TAG_BYTES) {
          this.dropEntry(key);
          return null;
        }
        const nonce: Uint8Array = blob.slice(0, NONCE_BYTES);
        const sealed: Uint8Array = blob.slice(NONCE_BYTES);
        const plain: Uint8Array = await this.crypt(false, sealed, nonce, key);
        return util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(plain);
      } catch (err) {
        // VERIFY: map the HUKS "authentication tag mismatch" error code to dropEntry(); until then an
        // undecryptable entry stays in place (STORAGE_UNAVAILABLE) rather than being destroyed on a transient fault.
        throw new SecureStoreError('HUKS read failed');
      }
    });
  }

  set(key: string, value: string): Promise<void> {
    return this.enqueue<void>(async (): Promise<void> => {
      try {
        await this.ensureKey();
        const nonce: Uint8Array = cryptoFramework.createRandom().generateRandomSync(NONCE_BYTES).data;
        const plain: Uint8Array = new util.TextEncoder().encodeInto(value);
        const sealed: Uint8Array = await this.crypt(true, plain, nonce, key);
        const blob: Uint8Array = new Uint8Array(nonce.length + sealed.length);
        blob.set(nonce, 0);
        blob.set(sealed, nonce.length);
        this.prefs.putSync(key, VERSION_PREFIX + new util.Base64Helper().encodeToStringSync(blob));
        this.prefs.flushSync();
      } catch (err) {
        throw new SecureStoreError('HUKS write failed');
      }
    });
  }

  remove(key: string): Promise<void> {
    return this.enqueue<void>(async (): Promise<void> => {
      try {
        this.prefs.deleteSync(key); // idempotent: deleting a missing key is not an error
        this.prefs.flushSync();
      } catch (err) {
        throw new SecureStoreError('Preferences write failed');
      }
    });
  }

  // --- HUKS -----------------------------------------------------------------------------------

  private async keyExists(): Promise<boolean> {
    const options: huks.HuksOptions = { properties: [] };
    return await huks.isKeyItemExist(KEY_ALIAS, options);
  }

  private async ensureKey(): Promise<void> {
    if (await this.keyExists()) {
      return;
    }
    const properties: Array<huks.HuksParam> = [
      { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
      { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
      {
        tag: huks.HuksTag.HUKS_TAG_PURPOSE,
        value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT | huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT,
      },
      { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
      { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
    ];
    const options: huks.HuksOptions = { properties: properties };
    await huks.generateKeyItem(KEY_ALIAS, options);
  }

  /**
   * One AES-GCM operation through a HUKS session (initSession -> finishSession).
   * encrypt: returns ciphertext || tag.  decrypt: takes ciphertext || tag.
   * VERIFY: that finishSession(ENCRYPT) appends the 16-byte tag to outData and that decrypt
   * wants it split off into HUKS_TAG_AE_TAG — this is how the Huawei AES-GCM sample is written
   * ("AES/GCM" in the UniversalKeystoreKit guides), not something the API reference states.
   */
  private async crypt(encrypt: boolean, input: Uint8Array, nonce: Uint8Array, storageKey: string): Promise<Uint8Array> {
    const aad: Uint8Array = new util.TextEncoder().encodeInto(AAD_PREFIX + storageKey);
    const baseProps: Array<huks.HuksParam> = [
      { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
      { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
      {
        tag: huks.HuksTag.HUKS_TAG_PURPOSE,
        value: encrypt ? huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT : huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT,
      },
      { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
      { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
      { tag: huks.HuksTag.HUKS_TAG_DIGEST, value: huks.HuksKeyDigest.HUKS_DIGEST_NONE },
      { tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce },
      { tag: huks.HuksTag.HUKS_TAG_ASSOCIATED_DATA, value: aad },
    ];
    const initOptions: huks.HuksOptions = { properties: baseProps };
    const session: huks.HuksSessionHandle = await huks.initSession(KEY_ALIAS, initOptions);

    let data: Uint8Array = input;
    const finishProps: Array<huks.HuksParam> = baseProps.slice();
    if (!encrypt) {
      data = input.slice(0, input.length - TAG_BYTES);
      finishProps.push({ tag: huks.HuksTag.HUKS_TAG_AE_TAG, value: input.slice(input.length - TAG_BYTES) });
    }
    const finishOptions: huks.HuksOptions = { properties: finishProps, inData: data };
    try {
      const result: huks.HuksReturnResult = await huks.finishSession(session.handle, finishOptions);
      if (result.outData === undefined) {
        throw new SecureStoreError('HUKS returned no data');
      }
      return result.outData;
    } catch (err) {
      try {
        await huks.abortSession(session.handle, finishOptions);
      } catch (abortErr) {
        // The session is already closed; nothing to clean up.
      }
      throw err;
    }
  }

  private dropEntry(key: string): void {
    try {
      this.prefs.deleteSync(key);
      this.prefs.flushSync();
    } catch (err) {
      // Best effort: the next successful set() overwrites the entry anyway.
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run: Promise<T> = this.queue.then(operation);
    // Keep the chain alive after a failure so one error does not wedge every later call.
    this.queue = run.then((): void => {}, (): void => {});
    return run;
  }
}
