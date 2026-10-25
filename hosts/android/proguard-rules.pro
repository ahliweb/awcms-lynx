# Reference snippet — append to app/proguard-rules.pro AFTER the Lynx block.
#
# 1. The Lynx block (the "# LYNX START ... # LYNX END" rules from
#    guide/start/fragments/android/integrating-lynx-with-existing-app-android.mdx)
#    is REQUIRED in release builds. It already contains:
#      -keep class * extends com.lynx.jsbridge.LynxModule { *; }
#      -keepclasseswithmembers class * { @com.lynx.jsbridge.LynxMethod <methods>; }
#    which keep AwcmsHostBridgeModule and its @LynxMethod `call`.
#    Lynx looks the module class up by reflection and the method by name, so an
#    obfuscated `call` would make NativeModules.AwcmsHostBridge.call undefined
#    at runtime — a silent failure that only shows up in release builds.
#    Copy the block from the docs of the Lynx version you pin; do not rely on this file.
#
# 2. Belt and braces for our own module (explicit, survives a Lynx rules change):
-keep class id.ahliweb.awcms.lynx.host.AwcmsHostBridgeModule { *; }

# 3. Keystore / JCA classes are platform classes: nothing to keep. No reflection is
#    used by KeystoreSecureStore, so R8 can shrink and obfuscate it freely.

# 4. Release hygiene: strip Log.d/v/i from our own package if you add logging
#    (never log keys, values or URLs from the bridge).
# -assumenosideeffects class android.util.Log { public static *** d(...); public static *** v(...); }
