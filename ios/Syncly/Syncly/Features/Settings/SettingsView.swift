import SwiftUI
import PhotosUI

struct SettingsView: View {
    @Environment(AppContainer.self) private var app
    var body: some View {
        Form {
            DemoNotice()
            Section("You") { NavigationLink("Profile",destination:ProfileSettingsView()); NavigationLink("Planning defaults",destination:PlanningSettingsView()); NavigationLink("Account and security",destination:AccountSettingsView()) }
            Section("Preferences") { NavigationLink("Appearance",destination:AppearanceSettingsView()); NavigationLink("Privacy choices",destination:ConsentSettingsView()); NavigationLink("Push notifications",destination:PushSettingsView()); NavigationLink("Guardian links",destination:GuardianLinksView()); NavigationLink("Family hub",destination:FamilyHubView()) }
            Section("About Syncly") { LegalLinks(); if let url = URL(string:"mailto:syncly.web.support@gmail.com") { Link("Contact support",destination:url) } }
            Section { ActionButton(title:app.isDemo ? "Exit demo" : "Sign out",workingTitle:"Signing out…") { try await app.leave() } }
        }.synclyList().navigationTitle("Settings")
    }
}
struct ProfileSettingsView: View {
    @Environment(AppContainer.self) private var app
    @State private var name = ""
    @State private var emoji = ""
    @State private var bio = ""
    @State private var school = ""
    @State private var grad = ""
    @State private var phone=""
    @State private var shareContact=false
    @State private var image: PhotosPickerItem?
    @State private var imageError: String?
    var body: some View {
        Form {
            Section("Profile") {MemberAvatarView(url:app.profile["avatar_url"].text,emoji:app.profile["avatar_emoji"].text,size:64); TextField("Name",text:$name); TextField("Avatar emoji",text:$emoji); PhotosPicker("Choose avatar photo",selection:$image,matching:.images); InlineFailure(message:imageError); TextField("Bio",text:$bio,axis:.vertical).lineLimit(2...5); TextField("School",text:$school); TextField("Graduation year",text:$grad).keyboardType(.numberPad) }
            Section("Family contact") {TextField("Phone (optional)",text:$phone).keyboardType(.phonePad);Toggle("Share contact with authorized parents",isOn:$shareContact);Text("Parents of friends attending shared plans may see your phone number when you enable this.").font(.footnote)}
            Section { Text("Member cards can show your name, avatar, bio, school and graduation year.").font(.footnote); ActionButton(title:"Save profile",workingTitle:"Saving…") { _ = try await app.call("saveProfile",["display_name":.string(name),"avatar_emoji":.string(emoji),"bio":.string(bio),"school":.string(school),"grad_year":.string(grad),"phone":.string(phone),"share_contact_with_parents":.bool(shareContact)]); try await app.loadProfile() } }
        }.synclyList().navigationTitle("Profile").onAppear {name = app.profile["display_name"].text; emoji = app.profile["avatar_emoji"].text; bio = app.profile["bio"].text; school = app.profile["school"].text; grad = app.profile["grad_year"].number.map {String(Int($0))} ?? "";phone=app.profile["phone"].text;shareContact=app.profile["share_contact_with_parents"].flag}
        .task(id:image) {
            guard let image else { return }
            do { guard let data = try await image.loadTransferable(type:Data.self) else {throw ServiceFailure(message:"Could not read that image.")}; let (dataURL,ext) = try SafeUpload.image(data); _ = try await app.call("uploadAvatar",["dataUrl":.string(dataURL),"ext":.string(ext)]); try await app.loadProfile() } catch {imageError = error.localizedDescription}
        }
    }
}
struct PlanningSettingsView: View {
    @Environment(AppContainer.self) private var app
    @State private var budget = ""
    @State private var curfew = ""
    @State private var zip = ""
    @State private var transportation = false
    @State private var parentApproval = false
    @State private var personalization = false
    @State private var notifications = true
    var body: some View {
        Form {
            Section {NavigationLink("Home area",destination:HomeLocationSettingsView())}
            Section("Private defaults") { TextField("Budget preference",text:$budget); TextField("Home by (HH:MM)",text:$curfew); TextField("ZIP code",text:$zip).keyboardType(.numberPad); Toggle("I need transportation",isOn:$transportation); Toggle("Parent approval required",isOn:$parentApproval); Toggle("Personalize planning",isOn:$personalization); Toggle("In-app notifications",isOn:$notifications) }
            Section { Text("Defaults inform your own planning answers. Other members do not receive your raw constraints.").font(.footnote); ActionButton(title:"Save defaults") { _ = try await app.call("saveProfile",["budget_preference":.string(budget),"curfew_time":.string(curfew),"zip_code":.string(zip),"needs_transportation":.bool(transportation),"parent_approval_required":.bool(parentApproval),"personalization_enabled":.bool(personalization),"notifications_enabled":.bool(notifications)]); try await app.loadProfile() } }
        }.synclyList().navigationTitle("Planning defaults").onAppear {budget = app.profile["budget_preference"].text; curfew = app.profile["curfew_time"].text; zip = app.profile["zip_code"].text; transportation = app.profile["needs_transportation"].flag; parentApproval = app.profile["parent_approval_required"].flag; personalization = app.profile["personalization_enabled"].flag; notifications = app.profile["notifications_enabled"].flag}
    }
}
struct AccountSettingsView: View {
    @Environment(AppContainer.self) private var app
    @State private var security = ResourceModel()
    @State private var emailMFA: String?
    @State private var exportData=Data()
    @State private var exporting=false
    @State private var exportError:String?
    @State private var password=""
    @State private var confirm=""
    @State private var recoveryEmail=""
    @State private var emailNotice=""
    var body: some View {
        Form {
            Section("Account security") {
                Text("Email verification: \(security.value["enabled"].flag ? "On" : "Off")")
                Button(security.value["enabled"].flag ? "Turn off email verification" : "Set up email verification") {emailMFA = security.value["enabled"].flag ? "disable" : "enroll"}
                Text("Email second-factor setup requires a password or Google primary sign-in.").font(.footnote)
                if !app.isDemo,app.client?.auth.currentUser?.emailConfirmedAt == nil {
                    TextField("Recovery email",text:$recoveryEmail).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    ActionButton(title:"Add and confirm email") {guard let client=app.client else {throw ServiceFailure(message:"Connect your account first.")};_ = try await client.auth.update(user:.init(email:recoveryEmail.trimmingCharacters(in:.whitespacesAndNewlines)),redirectTo:URL(string:"syncly://auth-callback"));emailNotice="Check your email to confirm the address."}
                    Text(emailNotice)
                }
                InlineFailure(message:security.error)
            }
            Section("Password") {
                SecureField("New password",text:$password).textContentType(.newPassword)
                SecureField("Confirm password",text:$confirm).textContentType(.newPassword)
                ActionButton(title:"Update password") {guard !app.isDemo,let auth=app.auth else {throw ServiceFailure(message:"A real account is required to update a password.")};guard password.count >= 6,password == confirm else {throw ServiceFailure(message:"Use at least six characters and match both passwords.")};try await auth.updatePassword(password);password="";confirm=""}
            }
            Section {NavigationLink("Existing verification methods",destination:ExistingFactorsView())}
            Section("Your data") {
                ActionButton(title:"Export my account data") {let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys];exportData=try encoder.encode(try await app.call("exportAccountData"));exporting=true}
                InlineFailure(message:exportError)
            }
            Section {NavigationLink("Delete my account",destination:DeleteAccountView()).foregroundStyle(.red)}
        }.synclyList().navigationTitle("Account").fileExporter(isPresented:$exporting,document:AccountExportDocument(data:exportData),contentType:.json,defaultFilename:"Syncly account export") {result in if case .failure = result {exportError="The export could not be saved. Try again."}}.task {await security.load(app,"getEmailSecurity")}
        .sheet(isPresented:Binding(get:{emailMFA != nil},set:{if !$0 {emailMFA = nil}}),onDismiss:{Task {await security.load(app,"getEmailSecurity")}}) { NavigationStack {EmailFactorView(purpose:emailMFA ?? "enroll")} }
    }
}
struct ConsentSettingsView: View {
    @State private var analytics = false
    @State private var marketing = false
    @State private var saved = false
    var body: some View {
        Form {
            Section("Your choices") { Text("Necessary storage keeps your session secure and remembers preferences. Optional integrations remain off until you choose them."); Toggle("Optional analytics",isOn:$analytics); Toggle("Optional marketing",isOn:$marketing) }
            Section { Button("Save privacy choices") { NativeConsent.save(analytics:analytics,marketing:marketing); saved = true }; if saved {Label("Choices saved",systemImage:"checkmark.circle")} }
        }.synclyList().navigationTitle("Privacy choices").onAppear {let c = NativeConsent.load(); analytics = c?.analytics ?? false; marketing = c?.marketing ?? false}
    }
}
nonisolated struct NativeConsent: Codable {
    let version: Int
    let necessary: Bool
    let analytics: Bool
    let marketing: Bool
    let savedAt: Date
    static func load(preferences: UserDefaults = .standard,now: Date = .now) -> Self? {
        guard let data = preferences.data(forKey:"syncly.privacy-consent"),let c = try? JSONDecoder().decode(Self.self,from:data),c.version == 1,c.necessary,c.savedAt <= now,now.timeIntervalSince(c.savedAt) < 180*86400 else {return nil}; return c
    }
    static func save(analytics: Bool,marketing: Bool,preferences: UserDefaults = .standard,now: Date = .now) {if let data = try? JSONEncoder().encode(Self(version:1,necessary:true,analytics:analytics,marketing:marketing,savedAt:now)) {preferences.set(data,forKey:"syncly.privacy-consent")}}
}

struct PushSettingsView: View {
    @Environment(AppContainer.self) private var app
    var body: some View {Form {
        Section {Text(app.push.status);ActionButton(title:"Enable push notifications") {try await app.push.enable()};InlineFailure(message:app.push.error);Text("In-app Activity works separately. APNs delivery requires owner provisioning and the native push backend; registration alone does not guarantee delivery.").font(.footnote)}
    }.synclyList().navigationTitle("Notifications")}
}
