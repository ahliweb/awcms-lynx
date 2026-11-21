package id.ahliweb.awcms.lynx

import android.app.Application
import id.ahliweb.awcms.lynx.host.AwcmsLynxHost

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        AwcmsLynxHost.initLynx(this)
    }
}
