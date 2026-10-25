//
//  KeychainSecureStore.swift
//
//  Reference implementation — adapt package/bundle ids. Original work (no code taken
//  from integrating-lynx-demo-projects); uses only Security.framework.
//
//  Secure storage for the `AwcmsHostBridge` contract on iOS: one Keychain item per
//  storage key.
//
//      kSecClass            = kSecClassGenericPassword
//      kSecAttrService      = "id.ahliweb.awcms.lynx"        (adapt to your bundle id family)
//      kSecAttrAccount      = <storage key>, e.g. "awcms-lynx:session"
//      kSecAttrAccessible   = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
//      kSecAttrSynchronizable = false
//
//  Why these attributes (threat model; the cross-platform table is in hosts/README.md):
//    * AfterFirstUnlock (not WhenUnlocked): the session must be readable while the
//      device is locked but has been unlocked once since boot, e.g. when a push
//      notification wakes the app. WhenUnlocked would make background refresh fail.
//    * ThisDeviceOnly: the item is excluded from encrypted/iCloud backups and from
//      device-to-device migration, so a token cannot be restored onto another device.
//    * Not synchronizable: never leaves the device through iCloud Keychain.
//    * No access group is set: the item is private to this app's default group.
//    * No biometric/passcode ACL: see Android's note — the session must be readable
//      without a prompt. Use SecAccessControl only for a step-up secret.
//  Not protected against: a jailbroken device, code in our own process, or a
//  malicious bundle that calls secureStorage.get with a well-formed key.
//
//  iOS Keychain items SURVIVE app deletion. `purgeOnFreshInstall()` wipes this
//  service on the first launch after an install (detected with a UserDefaults flag
//  that, unlike the Keychain, does NOT survive deletion), so a reinstall starts
//  signed out instead of resurrecting a stale token.
//

import Foundation
import Security

final class KeychainSecureStore: SecureStore {
    static let shared = KeychainSecureStore()

    /// Adapt together with the bundle id.
    static let service = "id.ahliweb.awcms.lynx"
    private static let installedFlag = "id.ahliweb.awcms.lynx.installed"

    // Serialises the update-then-add sequence in set(); Keychain calls themselves are thread-safe.
    private let lock = NSLock()

    func get(_ key: String) throws -> String? {
        lock.lock(); defer { lock.unlock() }
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess:
            guard let data = result as? Data, let text = String(data: data, encoding: .utf8) else {
                throw SecureStoreError(status: errSecDecode)
            }
            return text
        case errSecItemNotFound:
            return nil
        default:
            // e.g. errSecInteractionNotAllowed: device not yet unlocked since boot.
            throw SecureStoreError(status: status)
        }
    }

    func set(_ key: String, _ value: String) throws {
        lock.lock(); defer { lock.unlock() }
        guard let data = value.data(using: .utf8) else { throw SecureStoreError(status: errSecParam) }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        var status = SecItemUpdate(baseQuery(key) as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let item = baseQuery(key).merging(attributes) { _, new in new }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw SecureStoreError(status: status) }
    }

    func delete(_ key: String) throws {
        lock.lock(); defer { lock.unlock() }
        let status = SecItemDelete(baseQuery(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStoreError(status: status)
        }
    }

    /// Call once at launch, before the first LynxView is created (AwcmsLynxHost.bootstrap()).
    func purgeOnFreshInstall(defaults: UserDefaults = .standard) {
        guard !defaults.bool(forKey: Self.installedFlag) else { return }
        lock.lock(); defer { lock.unlock() }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
        ]
        SecItemDelete(query as CFDictionary) // errSecItemNotFound on a truly fresh device: fine
        defaults.set(true, forKey: Self.installedFlag)
    }

    private func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: false,
        ]
    }
}
