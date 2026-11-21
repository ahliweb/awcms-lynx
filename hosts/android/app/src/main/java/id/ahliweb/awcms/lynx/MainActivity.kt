package id.ahliweb.awcms.lynx

import id.ahliweb.awcms.lynx.host.AwcmsLynxActivity
import id.ahliweb.awcms.lynx.host.AwcmsRuntimeConfig

/** Per-flavour defaults; one signed binary can still be repointed with globalProps from here. */
class MainActivity : AwcmsLynxActivity() {
    override fun runtimeConfig() = AwcmsRuntimeConfig(
        backend = "awcms-one",
        apiBaseUrl = BuildConfig.AWCMS_API_BASE_URL,
        storefrontOrigin = BuildConfig.AWCMS_STOREFRONT_ORIGIN,
        locale = "id",
        environment = if (BuildConfig.DEBUG) "development" else "production",
    )
}
