// The household key in iCloud Keychain (docs/architecture.md, D4: the second
// recovery route). A synchronizable generic-password item: iCloud Keychain
// carries it to the person's other Apple devices, and to a new iPhone signed
// in to the same Apple account, where the app can read it back.
//
// The item is readable only by this app (its bundle id and team), so the
// final App Store bundle id must be chosen before people rely on it.

import ExpoModulesCore
import Security

public final class KeyBackupModule: Module {
  private let service = "app.proviso.household-key"

  public func definition() -> ModuleDefinition {
    Name("KeyBackup")

    Constant("storeName") { "iCloud Keychain" }

    AsyncFunction("save") { (account: String, secret: String) -> String in
      let match: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: self.service,
        kSecAttrAccount as String: account,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
      ]
      SecItemDelete(match as CFDictionary)
      var add = match
      add[kSecValueData as String] = Data(secret.utf8)
      // Synchronizable items can't be "this device only".
      add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      add[kSecAttrLabel as String] = "Proviso household key"
      let status = SecItemAdd(add as CFDictionary, nil)
      guard status == errSecSuccess else { throw KeychainException(status) }
      return "saved"
    }

    AsyncFunction("restore") { () -> [[String: String]] in
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: self.service,
        kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
        kSecReturnAttributes as String: true,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitAll,
      ]
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecItemNotFound { return [] }
      guard status == errSecSuccess, let items = result as? [[String: Any]] else { throw KeychainException(status) }
      return items.compactMap { item in
        guard let account = item[kSecAttrAccount as String] as? String,
              let data = item[kSecValueData as String] as? Data,
              let secret = String(data: data, encoding: .utf8) else { return nil }
        return ["account": account, "secret": secret]
      }
    }
  }
}

internal final class KeychainException: GenericException<OSStatus> {
  override var reason: String {
    "iCloud Keychain couldn’t save or read the key (status \(param)). Check that iCloud Keychain is on in Settings."
  }
}
