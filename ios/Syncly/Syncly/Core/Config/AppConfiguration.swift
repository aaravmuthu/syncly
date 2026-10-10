import Foundation

nonisolated struct AppConfiguration: Sendable {
    let supabaseURL: URL
    let publishableKey: String
    let apiURL: URL

    enum Error: Swift.Error, Equatable, Sendable {
        case missingValue(String)
        case insecureURL(String)
        case invalidPublishableKey
    }

    init(values: [String: String]) throws(Error) {
        func required(_ name: String) throws(Error) -> String {
            guard let value = values[name], !value.isEmpty, !value.contains("$(") else {
                throw .missingValue(name)
            }
            return value
        }
        func secureURL(_ name: String) throws(Error) -> URL {
            let value = try required(name)
            guard let url = URL(string: value), url.scheme == "https", let host = url.host,
                  !host.isEmpty, url.user == nil, url.password == nil else {
                throw .insecureURL(name)
            }
            return url
        }
        supabaseURL = try secureURL("SUPABASE_URL")
        apiURL = try secureURL("SYNCLY_API_URL")
        let key = try required("SUPABASE_PUBLISHABLE_KEY")
        if key.hasPrefix("sb_publishable_") {
            guard key.count > "sb_publishable_".count else { throw .invalidPublishableKey }
        } else {
            let parts = key.split(separator: ".", omittingEmptySubsequences: false)
            guard parts.count == 3 else { throw .invalidPublishableKey }
            var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+")
                .replacingOccurrences(of: "_", with: "/")
            payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
            guard let bytes = Data(base64Encoded: payload),
                  let object = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
                  object["role"] as? String == "anon" else { throw .invalidPublishableKey }
        }
        publishableKey = key
    }

    static func load(bundle: Bundle = .main) throws(Error) -> AppConfiguration {
        let names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SYNCLY_API_URL"]
        let values = names.reduce(into: [String: String]()) { values, name in
            values[name] = bundle.object(forInfoDictionaryKey: name) as? String
        }
        return try AppConfiguration(values: values)
    }
}
