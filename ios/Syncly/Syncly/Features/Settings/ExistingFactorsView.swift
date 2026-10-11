import SwiftUI
import Supabase

struct ExistingFactorsView:View {
    @Environment(AppContainer.self) private var app
    @State private var factors:[Factor]=[]
    @State private var selected=""
    @State private var challenge=""
    @State private var code=""
    @State private var error:String?
    var body:some View {
        Form {
            Section("Enrolled methods") {
                ForEach(factors) {factor in
                    Text(factor.friendlyName ?? (factor.factorType == "phone" ? "Text message" : "Authenticator"))
                    ConfirmAction(title:"Remove method",detail:"Removing this method changes how you verify your account.") {try await beginRemoval(factor)}
                }
                if factors.isEmpty {Text("No existing authenticator or phone methods")}
            }
            if !challenge.isEmpty {
                Section("Verify before removing") {
                    TextField("Verification code",text:$code).keyboardType(.numberPad).textContentType(.oneTimeCode)
                    ActionButton(title:"Verify and remove method") {try await verifyRemoval()}
                    Button("Cancel removal") {challenge="";selected="";code=""}
                }
            }
            InlineFailure(message:error)
        }.synclyList().navigationTitle("Verification methods").task {await reload()}
    }
    private func beginRemoval(_ factor:Factor) async throws {
        guard let client=app.client else {throw ServiceFailure(message:"Connect your account first.")}
        let assurance=try await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if assurance.currentLevel != "aal2" {
            selected=factor.id
            let result=try await client.auth.mfa.challenge(params:.init(factorId:factor.id,channel:factor.factorType == "phone" ? .sms : nil))
            challenge=result.id
            return
        }
        _ = try await client.auth.mfa.unenroll(params:.init(factorId:factor.id))
        await reload()
    }
    private func verifyRemoval() async throws {
        guard let client=app.client else {throw ServiceFailure(message:"Connect your account first.")}
        _ = try await client.auth.mfa.verify(params:.init(factorId:selected,challengeId:challenge,code:code))
        _ = try await client.auth.mfa.unenroll(params:.init(factorId:selected))
        challenge="";code="";await reload()
    }
    private func reload() async {
        guard !app.isDemo,let client=app.client else {return}
        do {factors=try await client.auth.mfa.listFactors().all.filter {$0.status == .verified && ($0.factorType == "phone" || $0.factorType == "totp")};error=nil}
        catch {self.error=error.localizedDescription}
    }
}
