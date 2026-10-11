import SwiftUI
import Supabase

struct AppEntryView: View {
    @Environment(AppContainer.self) private var app
    var body: some View {
        Group {
            switch app.stage {
            case .restoring: ProgressView("Opening Syncly…").frame(maxWidth:.infinity,maxHeight:.infinity).background(Theme.background)
            case .signedOut: AuthView()
            case .nativeFactor: NativeFactorView()
            case .emailFactor: EmailFactorView(purpose:"verify")
            case .agreement: AgreementView()
            case .onboarding: OnboardingView()
            case .passwordRecovery: PasswordRecoveryView()
            case .connectionPending: ConnectionPendingView()
            case .ready:
                #if DEBUG
                if let route=DemoSnapshotView.requestedRoute {DemoSnapshotView(route:route)} else {RootView()}
                #else
                RootView()
                #endif
            }
        }.sheet(isPresented:Binding(get:{app.approvalURL != nil},set:{if !$0 {app.approvalURL = nil}})) { if let url = app.approvalURL {ApprovalLinkView(url:url)} }.task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--demo") { await app.enterDemo() }
            else { await app.restore() }
            #else
            await app.restore()
            #endif
        }
    }
}
struct AuthView: View {
    @Environment(AppContainer.self) private var app
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var notice = ""
    @State private var signup = false
    @State private var emailCode = false
    @State private var sent = false
    @State private var accepted = false
    @State private var lastSent = Date.distantPast
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Your answers stay private",systemImage:"lock.shield").font(.headline)
                    Text("Sign in to plan with your people.").foregroundStyle(Theme.secondaryText)
                }
                Section(signup ? "Create your account" : "Log in") {
                    TextField("Email",text:$email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if sent { TextField("Six-digit email code",text:$code).textContentType(.oneTimeCode).keyboardType(.numberPad) }
                    else if !emailCode { SecureField("Password",text:$password).textContentType(signup ? .newPassword : .password) }
                    if signup { Toggle("I’m at least 13 and agree to the Terms of Service",isOn:$accepted); LegalLinks() }
                    ActionButton(title:sent ? "Verify code" : emailCode ? "Send sign-in code" : signup ? "Create account" : "Log in",workingTitle:"Signing in…") {
                        guard let auth = app.auth else { throw ServiceFailure(message:"Sign-in is unavailable.") }
                        let email = email.trimmingCharacters(in:.whitespacesAndNewlines)
                        guard email.contains("@"),email.count <= 254 else { throw ServiceFailure(message:"Enter a valid email address.") }
                        if signup && !accepted { throw ServiceFailure(message:"Please confirm your age and agreement before creating an account.") }
                        if sent { guard code.count == 6,code.allSatisfy(\.isNumber) else { throw ServiceFailure(message:"Enter the six-digit code from your email.") }; try await auth.verifyCode(email:email,code:code); try await app.finishSignIn() }
                        else if emailCode { try await auth.sendCode(email:email); sent = true; lastSent = .now; notice = "Check your email for your code." }
                        else {
                            guard !password.isEmpty else { throw ServiceFailure(message:"Enter your password.") }
                            let signed = try await auth.password(email:email,password:password,signup:signup)
                            password = ""
                            if signed { try await app.finishSignIn() }
                            else { notice = "Confirm your email, then log in."; signup = false }
                        }
                    }.buttonStyle(.borderedProminent)
                    InlineFailure(message:app.error)
                    if !notice.isEmpty { Text(notice).font(.subheadline) }
                    if sent {
                        ActionButton(title:"Send a new code") {
                            guard Date().timeIntervalSince(lastSent) >= 60 else { throw ServiceFailure(message:"Wait one minute before requesting another code.") }
                            try await app.auth?.sendCode(email:email); lastSent = .now
                        }
                    }
                }
                Section {
                    ActionButton(title:"Continue with Google",workingTitle:"Opening Google…") {
                        if signup && !accepted { throw ServiceFailure(message:"Confirm your agreement before creating an account.") }
                        guard let auth = app.auth else { throw ServiceFailure(message:"Sign-in is unavailable.") }
                        try await auth.google(); try await app.finishSignIn()
                    }
                    if !signup { Button(emailCode ? "Use password" : "Email me a sign-in code") { emailCode.toggle(); sent = false; code = "" } }
                    Button(signup ? "Already have an account? Log in" : "Create an account") { signup.toggle(); emailCode = false; sent = false; password = ""; code = ""; notice = "" }
                    ActionButton(title:"Forgot password?") {
                        guard email.contains("@") else { throw ServiceFailure(message:"Enter your email above first.") }
                        try await app.auth?.reset(email:email); notice = "Check your email for a reset link."
                    }
                }
                Section {
                    Button("Try the offline demo") { Task { await app.enterDemo() } }
                    Text("Explore a sample group without an account. Nothing is sent to other people.").font(.footnote).foregroundStyle(Theme.secondaryText)
                }
            }.synclyList().navigationTitle("Syncly")
        }
    }
}
struct ConnectionPendingView: View {
    @Environment(AppContainer.self) private var app
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Your account is signed in",systemImage:"checkmark.shield")
                    Text("Live features need the native API and verified privacy migration. You can explore all available sample flows offline while that connection is prepared.")
                    Button("Try the offline demo") { Task { await app.enterDemo() } }
                    ActionButton(title:"Sign out") { try await app.leave() }
                }
            }.synclyList().navigationTitle("Connection")
        }
    }
}
struct NativeFactorView: View {
    @Environment(AppContainer.self) private var app
    @State private var factors: [Factor] = []
    @State private var selected = ""
    @State private var challenge = ""
    @State private var code = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section("One more step") {
                    Text("Verify an existing authenticator or phone factor to finish signing in.")
                    Picker("Method",selection:$selected) { ForEach(factors) { f in Text(f.friendlyName ?? (f.factorType == "totp" ? "Authenticator app" : "Text message")).tag(f.id) } }
                    if !challenge.isEmpty { TextField("Six-digit code",text:$code).keyboardType(.numberPad).textContentType(.oneTimeCode) }
                    ActionButton(title:challenge.isEmpty ? "Start verification" : "Verify code") {
                        guard let client = app.client,let factor = factors.first(where: {$0.id == selected}) else { throw ServiceFailure(message:"Select a verification method.") }
                        if challenge.isEmpty { challenge = try await client.auth.mfa.challenge(params:.init(factorId:selected,channel:factor.factorType == "phone" ? .sms : nil)).id }
                        else { _ = try await client.auth.mfa.verify(params:.init(factorId:selected,challengeId:challenge,code:code)); try await app.finishSignIn() }
                    }
                    InlineFailure(message:error)
                    ActionButton(title:"Cancel sign-in") { try await app.leave() }
                }
            }.synclyList().navigationTitle("Verify account")
            .task { await loadFactors() }
        }
    }
    private func loadFactors() async {
        do {
            guard let client = app.client else { return }
            let result = try await client.auth.mfa.listFactors()
            factors = result.all.filter { $0.status == .verified && ($0.factorType == "phone" || $0.factorType == "totp") }
            selected = factors.first?.id ?? ""
            if factors.isEmpty { error = "No supported method was found. Contact support for recovery." }
        } catch { self.error = error.localizedDescription }
    }

}
struct EmailFactorView: View {
    let purpose: String
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var challenge: JSONValue = .null
    @State private var code = ""
    @State private var lastSent = Date.distantPast
    var body: some View {
        Form {
            Section("Separate email verification") {
                Text("Use the separate security code sent to your account email. A sign-in code does not count as a second factor.")
                if !challenge["challengeId"].text.isEmpty {
                    Text("Sent to \(challenge["destination"].text)")
                    TextField("Six-digit code",text:$code).keyboardType(.numberPad).textContentType(.oneTimeCode)
                    ActionButton(title:"Verify code") {
                        let result = try await app.call("verifyEmailSecondFactor",["purpose":.string(purpose),"challengeId":challenge["challengeId"],"code":.string(code)])
                        guard result["verified"].flag else { throw ServiceFailure(message:"The code could not be verified.") }
                        if purpose == "verify" { try await app.finishSignIn() } else { dismiss() }
                    }
                }
                ActionButton(title:challenge == .null ? "Send verification code" : "Send a new code") {
                    guard Date().timeIntervalSince(lastSent) >= 60 else { throw ServiceFailure(message:"Wait one minute before requesting another code.") }
                    challenge = try await app.call("sendEmailSecondFactor",["purpose":.string(purpose)]); lastSent = .now
                }
                ActionButton(title:"Cancel") { if purpose == "verify" { try await app.leave() } else { dismiss() } }
            }
        }.synclyList().navigationTitle("Email verification")
    }
}
struct AgreementView: View {
    @Environment(AppContainer.self) private var app
    @State private var accepted = false
    var body: some View {
        NavigationStack {
            Form {
                Section("Before you plan") { LegalLinks(); Toggle("I agree to the Terms of Service",isOn:$accepted) }
                Section { ActionButton(title:"Continue") { guard accepted else { throw ServiceFailure(message:"Read and accept the terms to continue.") }; _ = try await app.call("acceptTerms",["accepted":.bool(true)]); _ = try await app.client?.auth.refreshSession(); try await app.loadProfile() }; ActionButton(title:"Sign out") { try await app.leave() } }
            }.synclyList().navigationTitle("Your agreement")
        }
    }
}
struct OnboardingView: View {
    @Environment(AppContainer.self) private var app
    @State private var name = ""
    @State private var emoji = "🙂"
    @State private var type = "teen"
    @State private var zip = ""
    @State private var age = 16
    var body: some View {
        NavigationStack {
            Form {
                Section("Make it yours") { TextField("Name",text:$name); TextField("Avatar emoji",text:$emoji); Picker("I’m planning as",selection:$type) { Text("Squad member").tag("teen"); Text("Parent or guardian").tag("guardian") }; Stepper("Age: \(age)",value:$age,in:13...110); TextField("ZIP code (optional)",text:$zip).keyboardType(.numberPad) }
                Section { Text("Your planning answers stay private. Parent links need approval from the teen.").font(.footnote)
                    ActionButton(title:"Start planning") {
                        guard !name.trimmingCharacters(in:.whitespaces).isEmpty,name.count <= 60 else { throw ServiceFailure(message:"Enter a name up to 60 characters.") }
                        _ = try await app.call("saveProfile",["display_name":.string(name),"avatar_emoji":.string(emoji),"account_type":.string(type),"age":.number(Double(age)),"zip_code":.string(zip),"onboarded":.bool(true)]); try await app.loadProfile()
                    }
                }
            }.synclyList().navigationTitle("Your profile")
        }
    }
}
struct PasswordRecoveryView: View {
    @Environment(AppContainer.self) private var app
    @State private var password = ""
    var body: some View { NavigationStack { Form { Section { SecureField("New password",text:$password).textContentType(.newPassword); ActionButton(title:"Save password") { guard !password.isEmpty else { throw ServiceFailure(message:"Enter a new password.") }; try await app.auth?.updatePassword(password); password = ""; try await app.finishSignIn() } } }.synclyList().navigationTitle("Reset password") } }
}
struct LegalLinks: View {
    var body: some View { ForEach([("Terms","terms"),("Privacy","privacy"),("Accessibility","accessibility")],id:\.1) { title,path in if let url = URL(string:"https://syncly.website/\(path)") { Link(title,destination:url) } } }
}
