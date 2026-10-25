//
//  AwcmsLynxHost.swift
//
//  Reference implementation — adapt package/bundle ids; derived from
//  lynx-family/integrating-lynx-demo-projects (Apache-2.0):
//    ios/HelloLynxSwift  AppDelegate.swift, ViewController.swift, DemoLynxProvider.swift
//
//  Lynx references followed (docs live in lynx-family/lynx-website):
//    - guide/start/fragments/ios/integrating-lynx-with-existing-app-ios.mdx
//        LynxEnv.sharedInstance(), LynxView { builder in ... }, LynxConfig(provider:),
//        LynxTemplateProvider.loadTemplate(withUrl:onComplete:), layout modes
//    - guide/custom-native-modules/native-module-ios.mdx   LynxConfig.registerModule
//    - guide/custom-native-component/custom-component-iOS.mdx
//        "Local Registration": per-LynxView `builder.config` + register call (same pattern used for the module)
//    - api/lynx-native-api/lynx-load-meta.mdx   LynxLoadMeta.url / .globalProps
//    - api/lynx-native-api/template-data/from-map.mdx   LynxTemplateData(dictionary:)
//    - api/lynx-api/lynx/lynx-global-props.mdx   updateGlobalProps(with:)
//    - api/lynx-native-api/lynx-view/send-global-event.mdx   sendGlobalEvent(_:withParams:)
//
//  Bridging header (Lynx is Objective-C; see hosts/ios/README.md):
//      #import <Lynx/LynxConfig.h>
//      #import <Lynx/LynxEnv.h>
//      #import <Lynx/LynxModule.h>
//      #import <Lynx/LynxTemplateProvider.h>
//      #import <Lynx/LynxTemplateData.h>   // VERIFY header names for LynxTemplateData / LynxLoadMeta
//      #import <Lynx/LynxLoadMeta.h>       //        / LynxUpdateMeta in the pinned pod version
//      #import <Lynx/LynxView.h>
//
//  Bundle loading policy
//    Release: ONLY the bundle embedded in the app (main.lynx.bundle in "Copy Bundle Resources";
//             covered by the app signature). The remote branch is compiled out with #if DEBUG,
//             so a release binary has no code path that executes a downloaded bundle.
//    Debug:   embedded bundle, or an http(s) dev-server URL (rspeedy dev).
//

import UIKit

/// Runtime overrides handed to the bundle as `lynx.__globalProps`
/// (packages/platform/src/runtime-config.ts resolves them over build-time defaults).
/// Nothing secret belongs here: globalProps are readable by every script in the bundle.
/// nil/blank fields are omitted so the bundle's build-time defaults apply.
struct AwcmsRuntimeConfig {
    var backend: String?          // "awcms" | "awcms-one"
    var apiBaseUrl: String?       // https origin of the AWCMS backend
    var storefrontOrigin: String? // awcms-one only
    var tenantId: String?         // awcms only, UUID
    var locale: String?           // "en" | "id"
    var appName: String?
    var environment: String?      // "development" | "production"

    func toGlobalProps() -> [String: Any] {
        var props: [String: Any] = [:]
        func put(_ name: String, _ value: String?) {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return }
            props[name] = trimmed
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

enum AwcmsLynxHost {
    /// Must equal HOST_BRIDGE_MODULE in packages/platform/src/contract.ts (AwcmsHostBridgeModule.name).
    static let moduleName = "AwcmsHostBridge"
    static let defaultBundle = "main.lynx"
    /// Global event used to deliver deep links to the bundle (proposed; see hosts/README.md).
    static let deepLinkEvent = "awcms:deeplink"

    /// Call from `application(_:didFinishLaunchingWithOptions:)` (sample AppDelegate calls LynxEnv.sharedInstance()).
    static func bootstrap() {
        KeychainSecureStore.shared.purgeOnFreshInstall()
        _ = LynxEnv.sharedInstance()
    }

    /// Builds a LynxView sized to `size` and starts rendering.
    /// `bundle` is the embedded bundle name without ".bundle" ("main.lynx") or, in DEBUG builds only, an http(s) URL.
    static func makeLynxView(size: CGSize, config: AwcmsRuntimeConfig, bundle: String = defaultBundle) -> LynxView {
        let lynxView = LynxView { builder in
            let lynxConfig = LynxConfig(provider: AwcmsTemplateProvider())
            // native-module-ios.mdx registers on the *global* LynxConfig; custom-component-iOS.mdx
            // shows the per-view `builder.config` variant for elements. We use the per-view form.
            // VERIFY: that a module registered on the per-view config is visible to NativeModules
            // (else register it on the global config in LynxInitProcessor-style setup).
            lynxConfig.registerModule(AwcmsHostBridgeModule.self)
            builder.config = lynxConfig
            builder.screenSize = size
            builder.fontScale = 1.0
        }
        lynxView.preferredLayoutWidth = size.width
        lynxView.preferredLayoutHeight = size.height
        lynxView.layoutWidthMode = .exact
        lynxView.layoutHeightMode = .exact

        // lynx-load-meta.mdx (iOS). `url` goes to AwcmsTemplateProvider.
        let meta = LynxLoadMeta()
        meta.url = bundle
        meta.globalProps = LynxTemplateData(dictionary: config.toGlobalProps())
        // VERIFY: Swift spelling of `-[LynxView loadTemplate:]` (docs show ObjC; the sample uses
        // the older loadTemplate(fromURL:initData:), which cannot carry globalProps).
        lynxView.loadTemplate(meta)
        return lynxView
    }

    /// Pushes new runtime config (e.g. after a tenant switch) without reloading the bundle.
    static func updateGlobalProps(_ view: LynxView, config: AwcmsRuntimeConfig) {
        // lynx-global-props.mdx (iOS): -updateGlobalPropsWithDictionary:
        // VERIFY: Swift spelling, likely updateGlobalProps(with:).
        view.updateGlobalProps(with: config.toGlobalProps())
    }

    /// Forwards a deep link to the bundle as a global event. Only the app's own custom
    /// scheme is forwarded; the bundle must still treat the URL as untrusted input.
    static func forwardDeepLink(_ url: URL, to view: LynxView, scheme: String = "awcmslynx") {
        guard url.scheme?.lowercased() == scheme, url.absoluteString.utf16.count <= 2_048 else { return }
        // send-global-event.mdx (iOS): -sendGlobalEvent:withParams:
        view.sendGlobalEvent(deepLinkEvent, withParams: [url.absoluteString])
    }
}

/// Bundle provider. Derived from the sample's DemoLynxProvider, plus name validation
/// and (DEBUG only) a size-capped dev-server fetch.
final class AwcmsTemplateProvider: NSObject, LynxTemplateProvider {
    private static let bundleName = try! NSRegularExpression(pattern: "^[A-Za-z0-9._-]{1,128}\\z")
    private static let maxBundleBytes = 32 * 1024 * 1024

    func loadTemplate(withUrl url: String!, onComplete callback: LynxTemplateLoadBlock!) {
        guard let url = url else { return callback(nil, Self.error("Missing bundle name")) }

        #if DEBUG
        let lowered = url.lowercased()
        if lowered.hasPrefix("http://") || lowered.hasPrefix("https://") {
            fetchFromDevServer(url, callback)
            return
        }
        #endif

        // Embedded bundle: the sample resolves "main.lynx" -> main.lynx.bundle.
        let name = url.hasSuffix(".bundle") ? String(url.dropLast(".bundle".count)) : url
        let range = NSRange(name.startIndex..., in: name)
        guard Self.bundleName.firstMatch(in: name, range: range) != nil,
              !name.contains(".."),
              let path = Bundle.main.path(forResource: name, ofType: "bundle") else {
            return callback(nil, Self.error("Invalid bundle name"))
        }
        do {
            let data = try Data(contentsOf: URL(fileURLWithPath: path))
            callback(data, nil)
        } catch {
            callback(nil, error)
        }
    }

    #if DEBUG
    private func fetchFromDevServer(_ urlString: String, _ callback: @escaping LynxTemplateLoadBlock) {
        guard let url = URL(string: urlString) else { return callback(nil, Self.error("Invalid URL")) }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = "GET"
        // VERIFY: the callback block may be invoked from any queue (the sample calls it synchronously).
        URLSession(configuration: .ephemeral).dataTask(with: request) { data, response, error in
            if let error = error { return callback(nil, error) }
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let data = data, data.count <= Self.maxBundleBytes else {
                return callback(nil, Self.error("Dev server returned no usable bundle"))
            }
            callback(data, nil)
        }.resume()
    }
    #endif

    private static func error(_ message: String) -> NSError {
        NSError(domain: "id.ahliweb.awcms.lynx", code: 400, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

/// Sample ViewController, extended: owns one LynxView and keeps it sized to the view.
final class AwcmsLynxViewController: UIViewController {
    private let config: AwcmsRuntimeConfig
    private let bundle: String
    private var lynxView: LynxView?

    init(config: AwcmsRuntimeConfig, bundle: String = AwcmsLynxHost.defaultBundle) {
        self.config = config
        self.bundle = bundle
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let view = AwcmsLynxHost.makeLynxView(size: self.view.bounds.size, config: config, bundle: bundle)
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.view.addSubview(view)
        lynxView = view
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let lynxView = lynxView else { return }
        lynxView.frame = view.bounds
        // VERIFY: that changing preferredLayoutWidth/Height after load re-lays out the page
        // (rotation, iPad split view). Alternatively use LynxView.updateViewport (api/lynx-native-api/lynx-view/update-viewport.mdx).
        lynxView.preferredLayoutWidth = view.bounds.width
        lynxView.preferredLayoutHeight = view.bounds.height
    }

    /// Call from SceneDelegate `scene(_:openURLContexts:)` and, for cold start, `willConnectTo`.
    func handleDeepLink(_ url: URL) {
        guard let lynxView = lynxView else { return }
        AwcmsLynxHost.forwardDeepLink(url, to: lynxView)
    }
}
