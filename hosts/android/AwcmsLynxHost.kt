/*
 * Reference implementation — adapt package/bundle ids; derived from
 * lynx-family/integrating-lynx-demo-projects (Apache-2.0):
 *   android/KotlinEmptyProject  YourApplication.kt, MainActivity.kt, DemoTemplateProvider.kt
 *
 * Lynx references followed (docs live in lynx-family/lynx-website):
 *   - guide/start/fragments/android/integrating-lynx-with-existing-app-android.mdx
 *       service registration, LynxEnv.inst().init(app, null, null, null), LynxViewBuilder,
 *       AbsTemplateProvider, XElementBehaviors
 *   - guide/custom-native-modules/native-module-android.mdx
 *       LynxEnv.inst().registerModule(name, Class)
 *   - api/lynx-native-api/lynx-load-meta.mdx + lynx-view/load-template.mdx
 *       LynxLoadMeta.Builder().setUrl().setGlobalProps(TemplateData), LynxView.loadTemplate
 *   - api/lynx-native-api/template-data/from-map.mdx   TemplateData.fromMap
 *   - api/lynx-api/lynx/lynx-global-props.mdx          LynxView.updateGlobalProps(Map)
 *   - api/lynx-native-api/lynx-view/send-global-event.mdx  sendGlobalEvent(name, JavaOnlyArray)
 *
 * Usage (see hosts/android/README.md):
 *   class App : Application() { override fun onCreate() { super.onCreate(); AwcmsLynxHost.initLynx(this) } }
 *   class MainActivity : AwcmsLynxActivity()     // or copy its few lines into your own Activity
 *
 * Bundle loading policy
 *   release : ONLY assets/main.lynx.bundle (covered by the APK signature).
 *   debug   : assets, or an http(s) dev-server URL (rspeedy dev, e.g.
 *             http://10.0.2.2:3000/main.lynx.bundle from the emulator). Decided at
 *             runtime from FLAG_DEBUGGABLE, never from a config value the bundle or an
 *             Intent can influence in a release build.
 */
package id.ahliweb.awcms.lynx.host

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Bundle
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.imagepipeline.memory.PoolConfig
import com.facebook.imagepipeline.memory.PoolFactory
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.service.http.LynxHttpService
import com.lynx.service.image.LynxImageService
import com.lynx.service.log.LynxLogService
import com.lynx.tasm.LynxEnv
import com.lynx.tasm.LynxLoadMeta
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.TemplateData
import com.lynx.tasm.provider.AbsTemplateProvider
import com.lynx.tasm.service.LynxServiceCenter
import com.lynx.xelement.XElementBehaviors
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Runtime overrides handed to the bundle as `lynx.__globalProps`
 * (packages/platform/src/runtime-config.ts resolves them over build-time defaults).
 * Nothing secret belongs here: globalProps are readable by every script in the bundle.
 * Null/blank fields are omitted so the bundle's build-time defaults apply.
 */
data class AwcmsRuntimeConfig(
    val backend: String? = null,          // "awcms" | "awcms-one"
    val apiBaseUrl: String? = null,       // https origin of the AWCMS backend
    val storefrontOrigin: String? = null, // awcms-one only
    val tenantId: String? = null,         // awcms only, UUID
    val locale: String? = null,           // "en" | "id"
    val appName: String? = null,
    val environment: String? = null,      // "development" | "production"
) {
    fun toGlobalProps(): Map<String, Any> {
        val props = LinkedHashMap<String, Any>()
        fun put(name: String, value: String?) {
            if (!value.isNullOrBlank()) props[name] = value.trim()
        }
        put("backend", backend)
        put("apiBaseUrl", apiBaseUrl)
        put("storefrontOrigin", storefrontOrigin)
        put("tenantId", tenantId)
        put("locale", locale)
        put("appName", appName)
        put("environment", environment)
        return props
    }
}

object AwcmsLynxHost {
    /** Must equal HOST_BRIDGE_MODULE in packages/platform/src/contract.ts. */
    const val MODULE_NAME = "AwcmsHostBridge"
    const val DEFAULT_ASSET_BUNDLE = "main.lynx.bundle"
    /** Name of the global event used to deliver deep links to the bundle (proposed; see hosts/README.md). */
    const val DEEP_LINK_EVENT = "awcms:deeplink"

    /** Call once from Application.onCreate(), before any LynxView is created. */
    fun initLynx(app: Application) {
        // Fresco is required by LynxImageService (sample: YourApplication.initLynxService).
        val factory = PoolFactory(PoolConfig.newBuilder().build())
        val imageConfig = ImagePipelineConfig.newBuilder(app.applicationContext).setPoolFactory(factory)
        Fresco.initialize(app.applicationContext, imageConfig.build())

        LynxServiceCenter.inst().registerService(LynxImageService.getInstance())
        LynxServiceCenter.inst().registerService(LynxLogService)
        LynxServiceCenter.inst().registerService(LynxHttpService)

        // Docs: init(appContext, libraryLoader, templateProvider, behaviorBundle); nulls = defaults.
        LynxEnv.inst().init(app, null, null, null)

        // guide/custom-native-modules/native-module-android.mdx
        LynxEnv.inst().registerModule(MODULE_NAME, AwcmsHostBridgeModule::class.java)

        if (isDebuggable(app)) {
            // Devtool service/helper registration lives in a debug-only source set;
            // see hosts/android/README.md ("Devtool in debug builds").
            LynxEnv.inst().enableLynxDebug(true)
            LynxEnv.inst().enableDevtool(true)
            LynxEnv.inst().enableLogBox(true)
        }
    }

    /**
     * Builds a LynxView and starts rendering.
     * @param bundle asset name ("main.lynx.bundle") or, in debuggable builds only, an http(s) URL.
     */
    fun createView(
        activity: Activity,
        config: AwcmsRuntimeConfig,
        bundle: String = DEFAULT_ASSET_BUNDLE,
    ): LynxView {
        val allowRemote = isDebuggable(activity)
        val builder = LynxViewBuilder()
        builder.addBehaviors(XElementBehaviors().create()) // sample MainActivity.buildLynxView
        builder.setTemplateProvider(AwcmsTemplateProvider(activity, allowRemote))
        val view = builder.build(activity)

        // LynxLoadMeta.Builder: lynx-load-meta.mdx. `url` is handed to the template provider.
        val meta = LynxLoadMeta.Builder()
            .setUrl(bundle)
            .setGlobalProps(TemplateData.fromMap(config.toGlobalProps())) // template-data/from-map.mdx
            .build()
        // VERIFY: the sample (Lynx 3.8) calls renderTemplateUrl(uri, ""); the 4.x docs
        // describe loadTemplate(LynxLoadMeta). Confirm against the pinned SDK version.
        view.loadTemplate(meta)
        return view
    }

    /** Pushes new runtime config (e.g. after the user switches tenant) without reloading the bundle. */
    fun updateGlobalProps(view: LynxView, config: AwcmsRuntimeConfig) {
        view.updateGlobalProps(config.toGlobalProps()) // lynx-global-props.mdx (Android)
    }

    /**
     * Forwards a deep link to the bundle as a global event. Only the app's own
     * custom scheme is forwarded; the bundle must treat the URL as untrusted input anyway.
     */
    fun forwardDeepLink(view: LynxView, intent: Intent?, scheme: String = "awcmslynx") {
        val data = intent?.data ?: return
        val url = data.toString()
        if (data.scheme?.lowercase() != scheme || url.length > 2_048) return
        // send-global-event.mdx: sendGlobalEvent(String name, JavaOnlyArray params)
        // VERIFY: JavaOnlyArray.of(Object...) exists; else build with `JavaOnlyArray().apply { pushString(url) }`.
        view.sendGlobalEvent(DEEP_LINK_EVENT, JavaOnlyArray.of(url))
    }

    fun isDebuggable(context: Context): Boolean =
        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
}

/**
 * Bundle provider. Derived from the sample's DemoTemplateProvider (assets only), plus:
 *   - asset names are validated (no path traversal into other assets);
 *   - http(s) is honoured only when [allowRemote] (debuggable builds);
 *   - a response size cap and timeouts so a bad dev server cannot hang the app.
 * VERIFY: AbsTemplateProvider.Callback exposes onSuccess(ByteArray) / onFailed(String)
 * (as used by the sample).
 */
class AwcmsTemplateProvider(
    context: Context,
    private val allowRemote: Boolean,
) : AbsTemplateProvider() {

    private val appContext: Context = context.applicationContext

    override fun loadTemplate(uri: String, callback: Callback) {
        Thread {
            try {
                val bytes = when {
                    uri.startsWith("http://", ignoreCase = true) || uri.startsWith("https://", ignoreCase = true) -> {
                        if (!allowRemote) throw SecurityException("Remote bundles are disabled in this build")
                        fetch(uri)
                    }
                    ASSET_NAME.matches(uri) && !uri.contains("..") -> readAsset(uri)
                    else -> throw IllegalArgumentException("Invalid bundle name")
                }
                callback.onSuccess(bytes)
            } catch (e: Exception) {
                callback.onFailed(e.message ?: "Bundle load failed")
            }
        }.start()
    }

    private fun readAsset(name: String): ByteArray =
        appContext.assets.open(name).use { it.readBytes() }

    private fun fetch(url: String): ByteArray {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 5_000
            connection.readTimeout = 15_000
            connection.instanceFollowRedirects = false // a dev server has no reason to redirect
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                throw java.io.IOException("Dev server answered ${connection.responseCode}")
            }
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            connection.inputStream.use { input ->
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    out.write(buffer, 0, n)
                    if (out.size() > MAX_BUNDLE_BYTES) throw java.io.IOException("Bundle too large")
                }
            }
            return out.toByteArray()
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        val ASSET_NAME = Regex("^[A-Za-z0-9._/-]{1,128}$")
        const val MAX_BUNDLE_BYTES = 32 * 1024 * 1024
    }
}

/**
 * Minimal Activity (sample MainActivity, extended). Subclass it, or copy the 15 lines.
 * Intent extras may override the config ONLY in debuggable builds: an exported
 * launcher Activity must never let another app repoint the backend of a release build.
 */
open class AwcmsLynxActivity : Activity() {
    private var lynxView: LynxView? = null

    /** Override to supply the per-flavour defaults (staging vs production). */
    protected open fun runtimeConfig(): AwcmsRuntimeConfig = AwcmsRuntimeConfig()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        var config = runtimeConfig()
        var bundle = AwcmsLynxHost.DEFAULT_ASSET_BUNDLE
        if (AwcmsLynxHost.isDebuggable(this)) {
            intent?.getStringExtra("awcms.apiBaseUrl")?.let { config = config.copy(apiBaseUrl = it) }
            intent?.getStringExtra("awcms.bundleUrl")?.let { bundle = it }
        }
        val view = AwcmsLynxHost.createView(this, config, bundle)
        lynxView = view
        setContentView(view)
        AwcmsLynxHost.forwardDeepLink(view, intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        lynxView?.let { AwcmsLynxHost.forwardDeepLink(it, intent) }
    }

    override fun onDestroy() {
        lynxView?.destroy() // lynx-view/destroy.mdx
        lynxView = null
        super.onDestroy()
    }
}
