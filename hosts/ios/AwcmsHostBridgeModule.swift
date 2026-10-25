//
//  AwcmsHostBridgeModule.swift
//
//  Reference implementation — adapt package/bundle ids; derived from
//  lynx-family/integrating-lynx-demo-projects (Apache-2.0) and the Lynx
//  "Native Modules" guide (guide/custom-native-modules/native-module-ios.mdx,
//  Swift tab: `LynxModule` protocol, `static var name`, `static var methodLookup`,
//  `init(param:)` + `init()`, @objcMembers).
//
//  AwcmsHostBridge: the single Lynx NativeModule every AWCMS Lynx host registers
//  (packages/platform/src/contract.ts, HOST_BRIDGE_MODULE = "AwcmsHostBridge").
//
//      NativeModules.AwcmsHostBridge.call(method, params, callback)
//
//  The callback receives ONE argument: the reply as a JSON string,
//  {"ok":true,"result":{...}} or {"ok":false,"error":{"code":"...","message":"..."}}.
//  `parseHostReply` on the JS side accepts a string or an object; a string avoids
//  depending on how the Lynx iOS bridge converts nested NSDictionary blocks args.
//
//  Structure (contract logic is unit-testable without Lynx):
//    SecureStore / LinkOpening  : the two platform seams
//    HostBridgeDispatcher       : pure contract logic (validation, error codes, JSON)
//    AwcmsHostBridgeModule      : thin LynxModule adapter
//  hosts/contract-test-vectors.json is meant to be replayed against HostBridgeDispatcher.
//
//  Needs the Lynx headers in the bridging header (see hosts/ios/README.md):
//      #import <Lynx/LynxModule.h>
//
//  Security decisions:
//    * Every argument is untrusted and typed `Any?`: a hostile or buggy bundle must
//      get an error reply, never a Swift trap (a forced cast on a wrong type would
//      kill the whole app).
//    * Nothing is logged: keys, values and URLs stay out of the unified log.
//    * Error messages are fixed strings; OSStatus codes are not echoed to JS.
//

import Foundation
import UIKit

// MARK: - Seams

protocol SecureStore {
    func get(_ key: String) throws -> String?
    func set(_ key: String, _ value: String) throws
    func delete(_ key: String) throws
}

struct SecureStoreError: Error {
    let status: OSStatus
}

protocol LinkOpening {
    /// Called with an already-validated http(s) URL. `completion` may run on any thread.
    func open(_ url: URL, completion: @escaping (Bool) -> Void)
}

// MARK: - Contract logic

final class HostBridgeDispatcher {
    static let hostBridgeVersion = 1
    /// Counted in UTF-16 code units, exactly like JS `String.length` in contract.ts.
    static let maxValueLength = 16_384
    static let maxURLLength = 2_048

    // ICU's `$` also matches before a trailing newline, so `\z` is used for "end of input".
    private static let storageKey = try! NSRegularExpression(pattern: "^awcms-lynx:[a-z0-9:._-]{1,96}\\z")
    private static let controlOrSpace = try! NSRegularExpression(pattern: "[\\u0000-\\u0020\\u007f]")
    private static let scheme = try! NSRegularExpression(pattern: "^([A-Za-z][A-Za-z0-9+.-]*):")
    private static let httpURL = try! NSRegularExpression(
        pattern: "^https?://[^/?#@\\s]+([/?#].*)?\\z", options: [.caseInsensitive])

    private let store: SecureStore
    private let links: LinkOpening
    private let appVersion: String
    private let secureStorageBackend: String

    init(store: SecureStore, links: LinkOpening, appVersion: String, secureStorageBackend: String = "keychain") {
        self.store = store
        self.links = links
        self.appVersion = appVersion
        self.secureStorageBackend = secureStorageBackend
    }

    /// Always calls `reply` exactly once, with a JSON string. Never throws or traps.
    func dispatch(method: Any?, params: Any?, reply: @escaping (String) -> Void) {
        let dict = (params as? [String: Any]) ?? [:]
        switch method as? String {
        case "secureStorage.get":
            guard let key = Self.validKey(dict["key"]) else { return reply(Self.invalid("key")) }
            do {
                let stored = try store.get(key)
                reply(Self.ok(["value": stored.map { $0 as Any } ?? NSNull()]))
            } catch { reply(Self.fail("STORAGE_UNAVAILABLE", "Secure storage is unavailable")) }

        case "secureStorage.set":
            guard let key = Self.validKey(dict["key"]) else { return reply(Self.invalid("key")) }
            guard let value = dict["value"] as? String, value.utf16.count <= Self.maxValueLength else {
                return reply(Self.invalid("value"))
            }
            do {
                try store.set(key, value)
                reply(Self.ok(["stored": true]))
            } catch { reply(Self.fail("STORAGE_UNAVAILABLE", "Secure storage is unavailable")) }

        case "secureStorage.delete":
            guard let key = Self.validKey(dict["key"]) else { return reply(Self.invalid("key")) }
            do {
                try store.delete(key) // idempotent: a missing item still reports deleted
                reply(Self.ok(["deleted": true]))
            } catch { reply(Self.fail("STORAGE_UNAVAILABLE", "Secure storage is unavailable")) }

        case "app.info":
            reply(Self.ok([
                "host": "ios",
                "hostBridgeVersion": Self.hostBridgeVersion,
                "appVersion": appVersion,
                "secureStorage": secureStorageBackend,
            ]))

        case "link.open":
            openLink(dict["url"], reply: reply)

        default: // includes nil and non-string methods
            reply(Self.fail("UNKNOWN_METHOD", "Unknown method"))
        }
    }

    private func openLink(_ raw: Any?, reply: @escaping (String) -> Void) {
        guard let url = raw as? String, !url.isEmpty, url.utf16.count <= Self.maxURLLength else {
            return reply(Self.invalid("url"))
        }
        // Platform URL parsers strip whitespace/control characters ("java\nscript:"), so refuse them first.
        if Self.matches(Self.controlOrSpace, url) { return reply(Self.invalid("url")) }
        guard let schemeMatch = Self.scheme.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)),
              let schemeRange = Range(schemeMatch.range(at: 1), in: url) else {
            return reply(Self.invalid("url"))
        }
        let scheme = url[schemeRange].lowercased()
        guard scheme == "http" || scheme == "https" else {
            return reply(Self.fail("FORBIDDEN_SCHEME", "Only http(s) URLs may be opened"))
        }
        // Stricter than the JS regexp on purpose: a host is required and userinfo
        // ("https://trusted.example@evil.example") is refused as a phishing vector.
        guard Self.matches(Self.httpURL, url), let parsed = URL(string: url) else {
            return reply(Self.invalid("url"))
        }
        links.open(parsed) { opened in reply(Self.ok(["opened": opened])) }
    }

    // MARK: helpers

    private static func validKey(_ raw: Any?) -> String? {
        guard let key = raw as? String, matches(storageKey, key) else { return nil }
        return key
    }

    /// Anchoring lives in each pattern (`^` ... `\\z`); this only asks "is there a match".
    private static func matches(_ regex: NSRegularExpression, _ text: String) -> Bool {
        regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    private static func ok(_ result: [String: Any]) -> String {
        json(["ok": true, "result": result])
    }

    private static func invalid(_ field: String) -> String {
        fail("INVALID_PARAMS", "Invalid \(field)")
    }

    private static func fail(_ code: String, _ message: String) -> String {
        json(["ok": false, "error": ["code": code, "message": message]])
    }

    private static func json(_ object: [String: Any]) -> String {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              let text = String(data: data, encoding: .utf8) else {
            return #"{"ok":false,"error":{"code":"HOST_ERROR","message":"Host failed to handle the call"}}"#
        }
        return text
    }
}

// MARK: - link.open

/// `UIApplication.shared.open` must run on the main thread; Lynx calls modules on its own queue.
/// Use this only in the app target (UIApplication.shared is unavailable in app extensions).
struct UIApplicationLinkOpener: LinkOpening {
    func open(_ url: URL, completion: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in completion(opened) }
        }
    }
}

// MARK: - The Lynx module

@objcMembers
public final class AwcmsHostBridgeModule: NSObject, LynxModule {

    /// Exported name; must equal HOST_BRIDGE_MODULE in packages/platform/src/contract.ts.
    public static var name: String { "AwcmsHostBridge" }

    public static var methodLookup: [String: String] {
        ["call": NSStringFromSelector(#selector(call(_:params:callback:)))]
    }

    private let dispatcher: HostBridgeDispatcher

    // The guide's Swift sample declares both initialisers; Lynx may use either.
    public init(param: Any) {
        dispatcher = AwcmsHostBridgeModule.makeDispatcher()
        super.init()
    }

    public override init() {
        dispatcher = AwcmsHostBridgeModule.makeDispatcher()
        super.init()
    }

    /// `method` and `params` are `Any?` (not String/NSDictionary) so a wrong JS type
    /// reaches the dispatcher as an INVALID_PARAMS/UNKNOWN_METHOD reply instead of a bridge-level failure.
    /// VERIFY: that the Lynx iOS bridge accepts `id` for these parameters (the guide only
    /// shows NSString/block parameters) and invokes the method off the main thread.
    /// The callback is escaping because link.open replies after hopping to the main thread.
    public func call(_ method: Any?, params: Any?, callback: @escaping (NSString) -> Void) {
        dispatcher.dispatch(method: method, params: params) { reply in
            callback(reply as NSString)
        }
    }

    private static func makeDispatcher() -> HostBridgeDispatcher {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return HostBridgeDispatcher(
            store: KeychainSecureStore.shared,
            links: UIApplicationLinkOpener(),
            appVersion: version ?? "0.0.0"
        )
    }
}
