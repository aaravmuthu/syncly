import Foundation

/// Lossless wire value for existing server DTOs. UI accesses only explicit fields.
nonisolated enum JSONValue: Codable, Sendable, Equatable, Hashable {
    case object([String: JSONValue]), array([JSONValue]), string(String), number(Double), bool(Bool), null
    init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }
    func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    subscript(_ key: String) -> JSONValue {
        guard case .object(let v) = self else { return .null }
        return v[key] ?? .null
    }
    var text: String { if case .string(let v) = self { return v }; return "" }
    var number: Double? { if case .number(let v) = self { return v }; return nil }
    var flag: Bool { if case .bool(let v) = self { return v }; return false }
    var items: [JSONValue] { if case .array(let v) = self { return v }; return [] }
    var fields: [String: JSONValue] { if case .object(let v) = self { return v }; return [:] }
    func decoded<T: Decodable>(_ type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONEncoder().encode(self)) }
    static func encoded<T: Encodable>(_ value: T) throws -> JSONValue { try JSONDecoder().decode(Self.self, from: JSONEncoder().encode(value)) }
}
nonisolated struct WireRow: Identifiable, Sendable, Hashable {
    let value: JSONValue
    var id: String { for key in ["id","key","profile_id","profileId"] {let id=value[key].text;if !id.isEmpty {return id}};return "" }
    subscript(_ key: String) -> JSONValue { value[key] }
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.value == rhs.value }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
nonisolated struct ServiceFailure: LocalizedError, Sendable {
    let message: String
    var errorDescription: String? { message }
}
