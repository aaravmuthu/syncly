import Foundation
import Observation

@Observable
final class ResourceModel {
    var value: JSONValue = .null
    var error: String?
    var loading = false
    private var revision = 0
    func load(_ app: AppContainer,_ operation: String,_ body: [String:JSONValue] = [:]) async {
        revision += 1; let attempt = revision; loading = true; error = nil
        do {
            let result = try await app.call(operation,body)
            guard !Task.isCancelled,attempt == revision else { return }
            value = result
        } catch is CancellationError { }
        catch { if attempt == revision { self.error = error.localizedDescription } }
        if attempt == revision { loading = false }
    }
}
