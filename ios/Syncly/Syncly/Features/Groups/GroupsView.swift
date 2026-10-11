import SwiftUI
import CoreImage.CIFilterBuiltins
import VisionKit
import PhotosUI

struct GroupsView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var create = false
    @State private var join = false
    var body: some View {
        List {
            DemoNotice()
            ForEach(model.value.items.map(WireRow.init)) { row in NavigationLink { GroupDetailView(groupID:row.id) } label: {
                HStack(spacing:14) { MemberAvatarView(url:row["avatar_url"].text,emoji:row["emoji"].text).padding(5).background(GroupAppearanceTheme.resolve(row["cover_theme"].text).color.opacity(0.08),in:Circle()); VStack(alignment:.leading) { Text(row["name"].text).font(.headline); Text("\(Int(row["member_count"].number ?? 0)) members").font(.subheadline).foregroundStyle(Theme.secondaryText) } }
            } }
            if model.value.items.isEmpty,!model.loading { ContentUnavailableView("Your people, together",systemImage:"person.2",description:Text("Create a group or join with an invite.")) }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Groups")
        .toolbar { ToolbarItem(placement:.topBarTrailing) { Menu { Button("Create group",systemImage:"plus") { create = true }; Button("Join by code",systemImage:"qrcode") { join = true } } label: { Image(systemName:"plus") }.accessibilityLabel("Create or join group") } }
        .task { await model.load(app,"listGroups"); if app.pendingInvite != nil { join = true } }
        .onChange(of:app.pendingInvite) {_,invite in if invite != nil {join = true}}
        .refreshable { await model.load(app,"listGroups") }
        .sheet(isPresented:$create,onDismiss:reload) { NavigationStack { GroupFormView() } }
        .sheet(isPresented:$join,onDismiss:reload) { NavigationStack { JoinGroupView() } }
    }
    private func reload() { Task { await model.load(app,"listGroups") } }
}
struct GroupFormView: View {
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var emoji = "✨"
    @State private var purpose = ""
    @State private var kind = "permanent"
    var body: some View {
        Form {
            Section("Your group") { TextField("Name",text:$name); TextField("Emoji",text:$emoji); TextField("What’s the group for?",text:$purpose,axis:.vertical); Picker("Type",selection:$kind) { Text("Ongoing squad").tag("permanent"); Text("One-off circle").tag("temporary") } }
            Section { ActionButton(title:"Create group",workingTitle:"Creating…") { _ = try await app.call("createGroup",["name":.string(name),"emoji":.string(emoji),"kind":.string(kind),"purpose":.string(purpose)]); dismiss() }.buttonStyle(.borderedProminent) }
        }.synclyList().navigationTitle("New group").toolbar { ToolbarItem(placement:.cancellationAction) { Button("Cancel") { dismiss() } } }
    }
}
struct JoinGroupView: View {
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var scan = false
    @State private var scanError: String?
    var body: some View {
        Form {
            Section("Your invite") { TextField("Invite code",text:$code).textInputAutocapitalization(.characters).autocorrectionDisabled(); Text("Enter the code from your group’s invite. Offline sample: SYNCLYDEMO.").font(.footnote).foregroundStyle(Theme.secondaryText) }
            InlineFailure(message:scanError)
            Section { if DataScannerViewController.isSupported,DataScannerViewController.isAvailable {Button("Scan invite QR",systemImage:"qrcode.viewfinder") {scan = true}} }
            Section { ActionButton(title:"Join group",workingTitle:"Joining…") { let normalized = PlanningHelpers.inviteCode(code); guard (4...12).contains(normalized.count) else { throw ServiceFailure(message:"Enter a code with 4–12 letters or numbers.") }; _ = try await app.call("joinGroup",["code":.string(normalized)]); app.pendingInvite = nil; dismiss() }.buttonStyle(.borderedProminent) }
        }.synclyList().navigationTitle("Join group").sheet(isPresented:$scan) {InviteScannerView(onCode:{value in code = value;scan = false},onFailure:{message in scanError=message;scan=false})}.onAppear { code = app.pendingInvite ?? "" }.toolbar { ToolbarItem(placement:.cancellationAction) { Button("Cancel") { dismiss() } } }
    }
}
struct GroupDetailView: View {
    let groupID: String
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var create = false
    private var group: JSONValue { model.value["group"] }
    var body: some View {
        List {
            Section {
                DemoNotice()
                Label(group["name"].text,systemImage:"person.3.fill").font(.title2.bold())
                if let url = URL(string:"https://syncly.website/join/\(group["invite_code"].text)"),!group["invite_code"].text.isEmpty {
                    QRCodeView(text:url.absoluteString)
                    Text(group["invite_code"].text).font(.title3.monospaced()).textSelection(.enabled)
                    ShareLink("Share invite",item:url)
                }
            }
            Section("Members") { ForEach(model.value["members"].items.map(WireRow.init)) { row in
                NavigationLink {FriendProfileView(profileID:row["profile_id"].text)} label:{HStack { Text(row["profiles"]["avatar_emoji"].text); Text(app.displayName(row["profile_id"].text,fallback:row["profiles"]["display_name"].text)); Spacer(); Text(row["role"].text.capitalized).font(.caption).foregroundStyle(Theme.secondaryText) }}
            } }
            Section("Plans") { Button("Create a plan",systemImage:"plus") { create = true }; ForEach(model.value["plans"].items.map(WireRow.init)) { row in NavigationLink { PlanDetailView(planID:row.id) } label: { PlanRow(row:row) } } }
            Section { NavigationLink("Group chat") { ChatView(id:groupID,title:group["name"].text,direct:false) }; NavigationLink("Fair meeting places") {FairPointView(groupID:groupID)};NavigationLink("Group settings") { GroupSettingsView(groupID:groupID,group:group,members:model.value["members"].items) } }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle(group["name"].text.isEmpty ? "Group" : group["name"].text).navigationBarTitleDisplayMode(.inline)
        .task { await reload() }.refreshable { await reload() }
        .sheet(isPresented:$create,onDismiss:{Task {await reload()}}) { NavigationStack { PlanWizardView(initialGroupID:groupID) } }
    }
    private func reload() async { await model.load(app,"getGroup",["groupId":.string(groupID)]) }
}
struct QRCodeView: View {
    let text: String
    var body: some View {
        let filter = CIFilter.qrCodeGenerator()
        let _ = filter.setValue(Data(text.utf8),forKey:"inputMessage")
        if let output = filter.outputImage,let cg = CIContext().createCGImage(output,from:output.extent) {
            Image(decorative:cg,scale:1).interpolation(.none).resizable().scaledToFit().frame(width:160,height:160).padding(12).background(.white,in:RoundedRectangle(cornerRadius:12)).accessibilityLabel("Group invite QR code. Use the share invite button to share the same link.")
        }
    }
}
struct GroupSettingsView: View {
    let groupID: String
    let group: JSONValue
    let members: [JSONValue]
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var emoji = ""
    @State private var nextOwner = ""
    @State private var photo:PhotosPickerItem?
    @State private var photoError:String?
    @State private var cover="obsidian_emerald"
    @State private var kind="permanent"
    private var owner: Bool { group["created_by"].text == app.profile["id"].text }
    private var canEditLook:Bool {owner || members.contains {$0["profile_id"].text == app.profile["id"].text && $0["role"].text == "admin"}}
    var body: some View {
        Form {
            if canEditLook {
                Section("Appearance") { TextField("Name",text:$name); TextField("Emoji",text:$emoji);Picker("Cover",selection:$cover) {ForEach(GroupAppearanceTheme.all,id:\.id) {theme in Text(theme.label).tag(theme.id)}};Picker("Group type",selection:$kind) {Text("Ongoing squad").tag("permanent");Text("One-off circle").tag("temporary")};PhotosPicker("Choose group photo",selection:$photo,matching:.images);InlineFailure(message:photoError); ActionButton(title:"Save group") { _ = try await app.call("updateGroupLook",["groupId":.string(groupID),"name":.string(name),"emoji":.string(emoji),"coverTheme":.string(cover),"kind":.string(kind)]); dismiss() } }
            }
            if owner {
                Section("Ownership") { Picker("New owner",selection:$nextOwner) { Text("Choose a member").tag(""); ForEach(members.map(WireRow.init).filter {$0["profile_id"].text != app.profile["id"].text}) { r in Text(r["profiles"]["display_name"].text).tag(r["profile_id"].text) } }; ConfirmAction(title:"Transfer ownership",detail:"The chosen member will manage this group.") { guard !nextOwner.isEmpty else { throw ServiceFailure(message:"Choose a new owner.") }; _ = try await app.call("transferGroupOwnership",["groupId":.string(groupID),"toProfileId":.string(nextOwner)]); dismiss() } }
                Section { ConfirmAction(title:"Delete group",detail:"Plans and group records will be deleted. This cannot be undone.") { _ = try await app.call("deleteGroup",["groupId":.string(groupID)]); dismiss() } }
            }
            Section { ConfirmAction(title:"Leave group",detail:owner ? "Choose a new owner before leaving." : "You will lose access to this group and its plans.") { var body: [String:JSONValue] = ["groupId":.string(groupID)]; if owner { guard !nextOwner.isEmpty else { throw ServiceFailure(message:"Choose a new owner before leaving.") }; body["transferToProfileId"] = .string(nextOwner) }; _ = try await app.call("leaveGroup",body); dismiss() } }
        }.synclyList().navigationTitle("Group settings").onAppear { name = group["name"].text; emoji = group["emoji"].text;cover=GroupAppearanceTheme.resolve(group["cover_theme"].text).id;kind=group["kind"].text }.task(id:photo) {guard let photo else {return};do {guard let data=try await photo.loadTransferable(type:Data.self) else {throw ServiceFailure(message:"Could not read this image.")};let (dataURL,ext)=try SafeUpload.image(data);let uploaded=try await app.call("uploadGroupImage",["dataUrl":.string(dataURL),"ext":.string(ext)]);_ = try await app.call("updateGroupLook",["groupId":.string(groupID),"avatarUrl":uploaded["url"]]);photoError=nil} catch {photoError=error.localizedDescription}}
    }
}
