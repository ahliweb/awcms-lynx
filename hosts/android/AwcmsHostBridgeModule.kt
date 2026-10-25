/*
 * Reference implementation — adapt package/bundle ids; derived from
 * lynx-family/integrating-lynx-demo-projects (Apache-2.0) and the Lynx
 * "Native Modules" guide (guide/custom-native-modules/native-module-android.mdx).
 *
 * AwcmsHostBridge: the single Lynx NativeModule every AWCMS Lynx host registers
 * (packages/platform/src/contract.ts, HOST_BRIDGE_MODULE = "AwcmsHostBridge").
 *
 *   NativeModules.AwcmsHostBridge.call(method, params, callback)
 *
 * The callback receives ONE argument: the reply serialised as a JSON string,
 * `{"ok":true,"result":{...}}` or `{"ok":false,"error":{"code":"...","message":"..."}}`.
 * `parseHostReply` on the JS side accepts both a string and an object; a string
 * is used here because it crosses the Lynx bridge without depending on how
 * Callback marshals nested maps (one fewer thing to VERIFY).
 *
 * Structure (so the contract logic is unit-testable on the JVM, with no Lynx):
 *   - SecureStore / LinkOpener      : the two platform seams
 *   - HostBridgeDispatcher          : pure contract logic (validation, error codes, JSON)
 *   - AwcmsHostBridgeModule         : thin LynxModule adapter (ReadableMap -> Map, Callback)
 * hosts/contract-test-vectors.json is meant to be replayed against HostBridgeDispatcher.
 *
 * Security decisions:
 *   - Every input is untrusted: the bundle may be a remote dev-server bundle or,
 *     in the future, an OTA bundle. All validation happens here, natively, even
 *     though packages/platform validates in JS too (defence in depth).
 *   - Nothing here logs keys, values or URLs. Exception messages are never copied
 *     into replies (they can contain key material paths or user data).
 *   - No exception may escape call(): an uncaught throw on the Lynx module thread
 *     would crash the host for every user of a malformed bundle.
 */
package id.ahliweb.awcms.lynx.host

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.ReadableMap
import com.lynx.tasm.behavior.LynxContext
import org.json.JSONObject

/** Where secrets live. Implementations throw [SecureStoreException] on any failure. */
interface SecureStore {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun delete(key: String)
}

class SecureStoreException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Opens an already-validated http(s) URL in the system browser; false if nothing could handle it. */
fun interface LinkOpener {
    fun open(url: String): Boolean
}

/**
 * Pure contract logic, no Android/Lynx types except org.json (part of the
 * Android runtime; add `testImplementation("org.json:json:20240303")` for JVM tests).
 */
class HostBridgeDispatcher(
    private val store: SecureStore,
    private val links: LinkOpener,
    private val appVersion: String,
    private val secureStorageBackend: String = "android-keystore",
) {
    /** Returns the reply as a JSON string. Never throws. */
    fun dispatch(method: Any?, params: Map<String, Any?>?): String =
        try {
            route(method, params ?: emptyMap())
        } catch (e: SecureStoreException) {
            fail("STORAGE_UNAVAILABLE", "Secure storage is unavailable")
        } catch (e: Exception) {
            fail("HOST_ERROR", "Host failed to handle the call")
        }

    private fun route(method: Any?, params: Map<String, Any?>): String {
        // Anything that is not one of the five known strings is an unknown method,
        // including null and non-string values from a hostile bundle.
        return when (method) {
            "secureStorage.get" -> {
                val key = validKey(params["key"]) ?: return invalid("key")
                ok(JSONObject().put("value", store.get(key) ?: JSONObject.NULL))
            }
            "secureStorage.set" -> {
                val key = validKey(params["key"]) ?: return invalid("key")
                val value = params["value"] as? String
                if (value == null || value.length > MAX_VALUE_LENGTH) return invalid("value")
                store.set(key, value)
                ok(JSONObject().put("stored", true))
            }
            "secureStorage.delete" -> {
                val key = validKey(params["key"]) ?: return invalid("key")
                store.delete(key) // idempotent: deleting a missing key still reports deleted
                ok(JSONObject().put("deleted", true))
            }
            "app.info" -> ok(
                JSONObject()
                    .put("host", "android")
                    .put("hostBridgeVersion", HOST_BRIDGE_VERSION)
                    .put("appVersion", appVersion)
                    .put("secureStorage", secureStorageBackend),
            )
            "link.open" -> openLink(params["url"])
            else -> fail("UNKNOWN_METHOD", "Unknown method")
        }
    }

    private fun openLink(raw: Any?): String {
        val url = raw as? String
        if (url == null || url.isEmpty() || url.length > MAX_URL_LENGTH) return invalid("url")
        // Whitespace/control characters are stripped by platform URL parsers
        // ("java\nscript:", " javascript:"), so refuse them before looking at the scheme.
        if (CONTROL_OR_SPACE.containsMatchIn(url)) return invalid("url")
        val scheme = SCHEME.find(url)?.groupValues?.get(1)?.lowercase() ?: return invalid("url")
        if (scheme != "http" && scheme != "https") {
            return fail("FORBIDDEN_SCHEME", "Only http(s) URLs may be opened")
        }
        // Stricter than the JS regexp on purpose: a host is required and userinfo
        // ("https://trusted.example@evil.example") is refused as a phishing vector.
        if (!HTTP_URL.matches(url)) return invalid("url")
        return ok(JSONObject().put("opened", links.open(url)))
    }

    private fun validKey(raw: Any?): String? {
        val key = raw as? String ?: return null
        return if (STORAGE_KEY.matches(key)) key else null
    }

    private fun ok(result: JSONObject): String =
        JSONObject().put("ok", true).put("result", result).toString()

    private fun invalid(field: String): String = fail("INVALID_PARAMS", "Invalid $field")

    private fun fail(code: String, message: String): String =
        JSONObject()
            .put("ok", false)
            .put("error", JSONObject().put("code", code).put("message", message))
            .toString()

    companion object {
        const val HOST_BRIDGE_VERSION = 1
        /** Counted in UTF-16 code units, exactly like JS `String.length` in contract.ts. */
        const val MAX_VALUE_LENGTH = 16_384
        const val MAX_URL_LENGTH = 2_048
        val STORAGE_KEY = Regex("^awcms-lynx:[a-z0-9:._-]{1,96}$")
        private val CONTROL_OR_SPACE = Regex("[\\u0000-\\u0020\\u007f]")
        private val SCHEME = Regex("^([A-Za-z][A-Za-z0-9+.-]*):")
        private val HTTP_URL = Regex("^https?://[^/?#@\\s]+([/?#].*)?$", RegexOption.IGNORE_CASE)
    }
}

/**
 * The LynxModule. Registered by name in AwcmsLynxHost.initLynx():
 *   LynxEnv.inst().registerModule("AwcmsHostBridge", AwcmsHostBridgeModule::class.java)
 * (guide/custom-native-modules/native-module-android.mdx).
 *
 * Lynx instantiates module classes reflectively with a `(Context)` constructor,
 * exactly like NativeLocalStorageModule in the guide.
 */
class AwcmsHostBridgeModule(context: Context) : LynxModule(context) {

    private val dispatcher: HostBridgeDispatcher by lazy {
        // guide: `val lynxContext = mContext as LynxContext; lynxContext.getContext()`
        val appContext = (mContext as LynxContext).context.applicationContext
        HostBridgeDispatcher(
            store = KeystoreSecureStore.shared(appContext),
            links = BrowserLinkOpener(appContext),
            appVersion = versionName(appContext),
        )
    }

    /**
     * `@LynxMethod` is mandatory for exported methods (guide) and is kept by the
     * R8 rules in proguard-rules.pro.
     *
     * Parameter types follow the guide's type-mapping table: string -> String,
     * object -> ReadableMap, function -> Callback. A bundle that passes the wrong
     * JS types is rejected by Lynx itself before this method runs.
     * VERIFY: that Lynx throws a catchable JS error (and does not abort the app)
     * for a mismatched argument type; test with `call(1, 2, 3)` in the PoC.
     *
     * Runs on a Lynx module thread, not the UI thread; blocking Keystore calls are acceptable.
     */
    @LynxMethod
    fun call(method: String?, params: ReadableMap?, callback: Callback?) {
        val reply = try {
            // VERIFY: ReadableMap.toHashMap() exists in com.lynx.react.bridge (it does in the
            // React Native lineage Lynx's bridge derives from); not shown in the docs.
            dispatcher.dispatch(method, params?.toHashMap())
        } catch (e: Throwable) {
            """{"ok":false,"error":{"code":"HOST_ERROR","message":"Host failed to handle the call"}}"""
        }
        try {
            // Callback.invoke(Object...) as in the guide's NativeLocalStorageModule.
            callback?.invoke(reply)
        } catch (e: Throwable) {
            // The view may have been destroyed while we worked; nothing useful to do.
        }
    }

    private fun versionName(context: Context): String =
        try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0.0.0"
        } catch (e: PackageManager.NameNotFoundException) {
            "0.0.0"
        }
}

/**
 * link.open: ACTION_VIEW + CATEGORY_BROWSABLE for an http(s) URL.
 * We do not call resolveActivity(): on API 30+ it needs a <queries> entry
 * (package visibility) and would silently return null. Catching
 * ActivityNotFoundException needs no manifest entry.
 */
class BrowserLinkOpener(private val context: Context) : LinkOpener {
    override fun open(url: String): Boolean =
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                .addCategory(Intent.CATEGORY_BROWSABLE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) // application context has no task
            context.startActivity(intent)
            true
        } catch (e: Exception) { // ActivityNotFoundException, SecurityException
            false
        }
}
