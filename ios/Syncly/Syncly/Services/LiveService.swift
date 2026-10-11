import Foundation
import Supabase

nonisolated protocol SynclyService: Sendable {
    func call(_ operation: String, _ input: JSONValue) async throws -> JSONValue
    func registerPush(token:String,environment:String) async throws
}
extension SynclyService {
    func registerPush(token:String,environment:String) async throws {throw ServiceFailure(message:"Push delivery is unavailable in this mode.")}
}
actor LiveService: SynclyService {
    let client: SupabaseClient
    private let base: URL
    private let transport: URLSession
    init(configuration: AppConfiguration, client: SupabaseClient, transport: URLSession = .shared) {
        self.client = client; base = configuration.apiURL; self.transport = transport
    }
    func call(_ operation: String, _ input: JSONValue = .object([:])) async throws -> JSONValue {
        guard operation.range(of: "^[A-Za-z][A-Za-z0-9]+$", options: .regularExpression) != nil else {
            throw ServiceFailure(message: "That action is unavailable.")
        }
        return try await send(path:"operations/"+operation,input:input)
    }
    func registerPush(token:String,environment:String) async throws {
        _ = try await send(path:"push/register",input:.object(["token":.string(token),"environment":.string(environment),"bundleId":.string("website.syncly.app")]))
    }
    private func send(path:String,input:JSONValue) async throws -> JSONValue {
        let session = try await client.auth.session
        var request = URLRequest(url:base.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(input)
        request.timeoutInterval = 40
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ServiceFailure(message: "Please check your connection.") }
        guard http.value(forHTTPHeaderField: "Content-Type")?.contains("application/json") == true else {
            throw ServiceFailure(message: "The native connection is not available yet. You can try the offline demo.")
        }
        let body = try JSONDecoder().decode(JSONValue.self, from: data)
        guard (200..<300).contains(http.statusCode) else {
            let message = body["error"]["message"].text
            throw ServiceFailure(message: message.isEmpty ? "This action couldn’t be completed. Please try again." : message)
        }
        guard body.fields.keys.contains("data") else { throw ServiceFailure(message: "The connection returned an unexpected response.") }
        return body["data"]
    }
}
