import SwiftUI
import MapKit

struct FamilyHubView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var code = ""
    @State private var linkStatus = ""
    @FocusState private var codeFocused:Bool
    var body: some View {
        List {
            DemoNotice()
            Section("Your family") {
                ForEach(model.value["teens"].items.map(WireRow.init)) { r in NavigationLink { TeenDetailView(teen:r.value) } label: { HStack { Text(r["emoji"].text).font(.largeTitle); VStack(alignment:.leading) { Text(r["name"].text).font(.headline); Text(r["status"]["label"].text.isEmpty ? "View plans and safety updates" : r["status"]["label"].text).font(.subheadline) } } }.accessibilityIdentifier("family-teen-" + r.id) }
                if model.value["teens"].items.isEmpty,!model.loading { Text("Link your first teen to see shared plans and safety updates.") }
            }
            Section("Link a teen") {
                TextField("Teen’s Sync code",text:$code).focused($codeFocused).textInputAutocapitalization(.characters).autocorrectionDisabled()
                ActionButton(title:"Send link request") { let result = try await app.call("linkTeen",["code":.string(code)]); guard ["pending","linked"].contains(result["status"].text) else {throw ServiceFailure(message:"Refresh the family hub to check the request status.")};linkStatus=result["status"].text == "linked" ? "This teen is already linked." : "Link request sent. The teen decides whether to approve.";code = "";codeFocused=false;await reload() }
                if !linkStatus.isEmpty {Text(linkStatus).font(.subheadline)}
                Text("The teen must approve your request. A code alone never grants access to their location or private account.").font(.footnote)
            }
            Section("Alerts") {
                ForEach(model.value["alerts"].items.map(WireRow.init)) {r in VStack(alignment:.leading,spacing:5) {Text(r["title"].text).font(.headline);Text(r["body"].text);WireDateText(value:r["created_at"].text).font(.caption);if !r["plan_id"].text.isEmpty {NavigationLink("Open plan") {PlanDetailView(planID:r["plan_id"].text)}}}}
                if model.value["alerts"].items.isEmpty {Text("No new family alerts").foregroundStyle(.secondary)}
                ActionButton(title:"Mark alerts read") {_ = try await app.call("markAlertsRead");await reload()}
            }
            Section { NavigationLink("My linked guardians",destination:GuardianLinksView());NavigationLink("My check-ins",destination:CheckinsView()); NavigationLink("Family Plus",destination:FamilyPlusView()) }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Family hub").task {await reload()}.refreshable {await reload()}
        .onDisappear {codeFocused=false}
        .toolbar {ToolbarItemGroup(placement:.keyboard) {Spacer();Button("Done") {codeFocused=false}}}
    }
    private func reload() async { await model.load(app,"getGuardianHub") }
}
struct TeenDetailView: View {
    let initialTeen: JSONValue
    @State private var latestTeen: JSONValue = .null
    @State private var refreshError: String?
    private var teen: JSONValue { latestTeen == .null ? initialTeen : latestTeen }
    init(teen: JSONValue) { initialTeen = teen }
    @Environment(AppContainer.self) private var app
    @State private var checkinNote = ""
    @State private var safeZone = false
    @State private var summary:JSONValue = .null
    var body: some View {
        List {
            DemoNotice()
            Section("Sync’s family summary") {
                ActionButton(title:"Summarize safety updates",workingTitle:"Reviewing updates…") {summary=try await app.call("getGuardianAiSummary",["teenProfileId":teen["id"]])}
                if !summary["summary"].text.isEmpty {Text(summary["summary"].text);ForEach(summary["watchouts"].items.map(\.text),id:\.self) {Text($0)};Text("Review the original plans and updates before making safety decisions.").font(.footnote)}
            }
            Section("Safety radar") {
                if let lat = teen["location"]["lat"].number,let lon = teen["location"]["lon"].number {
                    Map { Marker(teen["name"].text,coordinate:.init(latitude:lat,longitude:lon)) }.frame(height:230)
                    WireDateText(value:teen["location"]["at"].text).font(.caption)
                } else { Label("No location update available",systemImage:"location.slash") }
                Text(teen["sharing"].flag ? "Sharing is enabled" : "Location sharing is off")
                TextField("Check-in note (optional)",text:$checkinNote)
                ActionButton(title:"Request check-in") { _ = try await app.call("askForCheckin",["teenProfileId":teen["id"],"note":.string(checkinNote)]);checkinNote="";await refreshTeen() }
            }
            Section("Plans and approvals") {
                ForEach(teen["plans"].items.map(WireRow.init)) { r in
                    VStack(alignment:.leading,spacing:8) {
                        Text(r["title"].text).font(.headline)
                        if !r["venue"].text.isEmpty {Text(r["venue"].text)}
                        Text(r["status"].text.capitalized).font(.caption)
                        if !r["approval"]["id"].text.isEmpty { NavigationLink("Review approval · \(r["approval"]["status"].text.replacingOccurrences(of:"_",with:" ").capitalized)") { GuardianApprovalView(plan:r.value,onDecided:{await refreshTeen()}) }.accessibilityIdentifier("review-approval-" + r.id) }
                        if !r["approval"]["condition_text"].text.isEmpty {Text("Condition: " + r["approval"]["condition_text"].text).font(.subheadline)}
                        if !r["supervision_note"].text.isEmpty { Text(r["supervision_note"].text) }
                        ForEach(r["rides"].items.map(WireRow.init)) { ride in GuardianRideView(ride:ride.value) }
                        ForEach(r["parentNetwork"].items.map(WireRow.init)) { parent in
                            VStack(alignment:.leading) {Text("\(parent["name"].text) · \(parent["teen_name"].text)’s \(parent["relation"].text)"); ParentPhoneLink(phone:parent["phone"].text)}
                        }
                    }
                }
            }
            Section("Safe zones") {
                ForEach(teen["zones"].items.map(WireRow.init)) { r in
                    VStack(alignment:.leading) { Text(r["label"].text); ConfirmAction(title:"Remove safe zone",detail:"Alerts for this zone will stop.") { _ = try await app.call("removeSafeZone",["zoneId":r["id"]]); await refreshTeen() } }
                }
                Button("Add safe zone") { safeZone = true }
            }
                    Section("Check-ins") {ForEach(teen["checkins"].items.map(WireRow.init)) {r in VStack(alignment:.leading) {Text(r["status"].text.capitalized);Text(r["note"].text);Text(r["place_label"].text);WireDateText(value:r["responded_at"].text).font(.caption)}}}
            Section("Delay updates") {ForEach(teen["delays"].items.map(WireRow.init)) {r in VStack(alignment:.leading) {Text(r["reason"].text);Text("About \(Int(r["minutes"].number ?? 0)) minutes late");WireDateText(value:r["new_eta"].text).font(.caption)}}}
            InlineFailure(message:refreshError)
        }.synclyList().navigationTitle(teen["name"].text).task {await refreshTeen()}.refreshable {await refreshTeen()}.sheet(isPresented:$safeZone,onDismiss:{Task {await refreshTeen()}}) { NavigationStack { SafeZoneView(teenID:teen["id"].text) } }
    }
    private func refreshTeen() async {
        do {let hub = try await app.call("getGuardianHub");guard let updated=hub["teens"].items.first(where:{$0["id"] == initialTeen["id"]}) else {latestTeen = .object(["id":initialTeen["id"],"name":initialTeen["name"]]);refreshError = "This family link is no longer available.";return};latestTeen=updated;refreshError=nil}
        catch {refreshError=error.localizedDescription}
    }
}
struct GuardianApprovalView: View {
    let plan: JSONValue
    var onDecided:(() async -> Void)? = nil
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var condition = ""
    var body: some View { Form {
        Section("Review the plan") { Text(plan["title"].text).font(.headline); if !plan["venue"].text.isEmpty {Text(plan["venue"].text)}; WireDateText(value:plan["window_start"].text); Text("Status: \(plan["approval"]["status"].text.replacingOccurrences(of:"_",with:" ").capitalized)"); if !plan["approval"]["decided_via"].text.isEmpty { Text("Decision recorded via \(plan["approval"]["decided_via"].text)") } }
        Section("Your decision") { TextField("Condition (optional)",text:$condition,axis:.vertical).accessibilityIdentifier("guardian-condition"); ForEach([("approved","Approve"),("approved_with_condition","Approve with condition"),("declined","Decline")],id:\.0) { value,label in ActionButton(title:label) { if value == "approved_with_condition",condition.trimmingCharacters(in:.whitespaces).isEmpty { throw ServiceFailure(message:"Enter your condition first.") }; _ = try await app.call("decidePlanApproval",["approvalId":plan["approval"]["id"],"decision":.string(value),"condition":.string(condition)]);await onDecided?();dismiss() } } }
        Section { Text("Guardian decisions are authoritative. Shared approval links cannot overwrite them.").font(.footnote) }
    }.synclyList().navigationTitle("Plan approval").onAppear {condition=plan["approval"]["condition_text"].text} }
}
struct GuardianLinksView: View {
    @Environment(AppContainer.self) private var app
    @State private var guardians = ResourceModel()
    @State private var requests = ResourceModel()
    @State private var code: JSONValue = .null
    @State private var error: String?
    var body: some View { List {
        Section("Your Sync code") { Text(code.text.isEmpty ? code["code"].text : code.text).font(.title.monospaced()).textSelection(.enabled); Text("Give this code to your parent. You still decide whether to approve their request.").font(.footnote) }
        Section("Pending requests") { ForEach(requests.value.items.map(WireRow.init)) { r in Text(r["guardian"]["display_name"].text.isEmpty ? "Parent link request" : r["guardian"]["display_name"].text); ActionButton(title:"Approve link") { _ = try await app.call("answerLinkRequest",["requestId":r["id"],"approve":.bool(true)]); await reload() }; ActionButton(title:"Decline") { _ = try await app.call("answerLinkRequest",["requestId":r["id"],"approve":.bool(false)]); await reload() } } }
        Section("Linked guardians") { ForEach(guardians.value.items.map(WireRow.init)) { r in Text(r["guardian"]["display_name"].text); ConfirmAction(title:"Unlink guardian",detail:"Their family access and associated location share will be revoked.") { _ = try await app.call("unlinkGuardian",["linkId":r["id"]]); await reload() } } }
        InlineFailure(message:error); InlineFailure(message:guardians.error); InlineFailure(message:requests.error)
    }.synclyList().navigationTitle("Guardian links").task {await reload()} }
    private func reload() async { await guardians.load(app,"getMyGuardians"); await requests.load(app,"getMyLinkRequests"); do {code = try await app.call("getMySyncCode")} catch {self.error = error.localizedDescription} }
}
struct FamilyPlusView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var interval = "month"
    var body: some View { Form {
        Section("Family Plus") { Text(model.value["tier"].text == "plus" ? "Your family has Plus" : "Free family plan").font(.headline); Text("Try Family Plus free for six months. No payment details are required.");Text(model.value["status"].text.capitalized);if !model.value["periodEnd"].text.isEmpty {LabeledContent("Plus access until") {WireDateText(value:model.value["periodEnd"].text)}.font(.footnote)}; Picker("Plan interval",selection:$interval) { Text("Monthly").tag("month"); Text("Yearly").tag("year") } }
        Section { if model.value["tier"].text == "plus" { ConfirmAction(title:"Cancel Family Plus",detail:"Existing access follows the current trial or period end.") { _ = try await app.call("cancelFamilyPlus"); await reload() } } else if model.value["trialAvailable"].flag { ActionButton(title:"Start founding-family trial") { _ = try await app.call("startFamilyPlus",["interval":.string(interval)]); await reload() } }; InlineFailure(message:model.error) }
    }.synclyList().navigationTitle("Family Plus").task {await reload()} }
    private func reload() async { await model.load(app,"getMyFamilyPlan") }
}
struct SafeZoneView: View {
    let teenID: String
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var kind = "home"
    @State private var radius = 200.0
    @State private var center: CLLocationCoordinate2D?
    var body: some View { Form {
        Section("Choose a place") { Map().frame(height:260).overlay {Image(systemName:"plus").font(.title)}.onMapCameraChange { center = $0.region.center }; Text("Move the map so the place is under the crosshair.").font(.footnote); TextField("Zone name",text:$label); Picker("Type",selection:$kind) { Text("Home").tag("home"); Text("School").tag("school"); Text("Other").tag("other") }; Slider(value:$radius,in:50...2000,step:50); Text("Radius: \(Int(radius)) meters") }
        Section { ActionButton(title:"Save safe zone") { guard let center,!label.trimmingCharacters(in:.whitespaces).isEmpty else { throw ServiceFailure(message:"Choose a place and name the zone.") }; _ = try await app.call("addSafeZone",["teenProfileId":.string(teenID),"label":.string(label),"kind":.string(kind),"lat":.number(center.latitude),"lon":.number(center.longitude),"radiusM":.number(radius)]); dismiss() } }
    }.synclyList().navigationTitle("Safe zone").toolbar {ToolbarItem(placement:.cancellationAction) {Button("Cancel") {dismiss()}}} }
}
