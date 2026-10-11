import SwiftUI
import UniformTypeIdentifiers

struct AccountExportDocument:FileDocument {
    static var readableContentTypes:[UTType] {[.json]}
    let data:Data
    init(data:Data) {self.data=data}
    init(configuration:ReadConfiguration) throws {guard let data=configuration.file.regularFileContents else {throw ServiceFailure(message:"This export could not be read.")};self.data=data}
    func fileWrapper(configuration:WriteConfiguration) throws -> FileWrapper {FileWrapper(regularFileWithContents:data)}
}
struct DeleteAccountView:View {
    @Environment(AppContainer.self) private var app
    @State private var confirmation=""
    var body:some View {
        Form {
            Section("Permanent deletion") {Text("Your account and owned records will be deleted under Syncly’s deletion rules. This cannot be undone.");TextField("Type DELETE to confirm",text:$confirmation).textInputAutocapitalization(.characters).autocorrectionDisabled()}
            Section {HoldToConfirm(title:"Hold to permanently delete") {
                guard confirmation == "DELETE" else {throw ServiceFailure(message:"Type DELETE before holding to confirm.")}
                guard !app.isDemo else {throw ServiceFailure(message:"There is no real account to delete in demo mode.")}
                _ = try await app.call("deleteAccount");try await app.leave()
            }.disabled(confirmation != "DELETE")}
        }.synclyList().navigationTitle("Delete account")
    }
}
