import SwiftUI
import MapKit
import UniformTypeIdentifiers

struct PlansView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var create = false
    @State private var filter = "All"
    var body: some View {
        List {
            DemoNotice()
            Picker("Plans",selection:$filter) { Text("All").tag("All"); Text("Upcoming").tag("Upcoming"); Text("Past").tag("Past") }.pickerStyle(.segmented)
            ForEach(model.value.items.filter { filter == "All" || (filter == "Past" ? ["completed","cancelled"].contains($0["status"].text) : !["completed","cancelled"].contains($0["status"].text)) }.map(WireRow.init)) { row in NavigationLink { PlanDetailView(planID:row.id) } label: { PlanRow(row:row) } }
            if model.value.items.isEmpty,!model.loading { ContentUnavailableView("Something to look forward to",systemImage:"calendar",description:Text("Start with a group and everyone’s private answers.")) }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Plans")
        .toolbar { ToolbarItem(placement:.topBarTrailing) { Button("New plan",systemImage:"plus") { create = true } } }
        .task { await model.load(app,"listPlans") }.refreshable { await model.load(app,"listPlans") }
        .sheet(isPresented:$create,onDismiss:{Task {await model.load(app,"listPlans")}}) { NavigationStack { PlanWizardView() } }
    }
}
struct PlanWizardView: View {
    var initialGroupID = ""
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var groups = ResourceModel()
    @State private var roster = ResourceModel()
    @State private var defaults = ResourceModel()
    @State private var groupID = ""
    @State private var title = ""
    @State private var category = "hangout"
    @State private var area = ""
    @State private var start = Date().addingTimeInterval(86400)
    @State private var end = Date().addingTimeInterval(93600)
    @State private var participants: Set<String> = []
    private let categories = [("dinner","Food & Drinks"),("hangout","Hangout"),("concert","Concert / Event"),("trip","Trip / Getaway"),("party","Party"),("sports","Sports & Rec"),("custom","Custom"),("movie","Movie"),("daytrip","Day trip"),("shopping","Shopping")]
    var body: some View {
        Form {
            Section("The plan") {
                TextField("Title",text:$title)
                Picker("Group",selection:$groupID) { Text("Choose a group").tag(""); ForEach(groups.value.items.map(WireRow.init)) { g in Text(g["name"].text).tag(g.id) } }
                Picker("Category",selection:$category) { ForEach(categories,id:\.0) { id,label in Text(label).tag(id) } }
                TextField("Area or ZIP code",text:$area)
            }
            if !groupID.isEmpty {Section("Saved defaults") {
                Text(defaults.value["summary"].text.isEmpty ? "Choose the group’s time and area, then review everyone’s private answers." : defaults.value["summary"].text)
                ActionButton(title:"Use suggested time and area") {try applyDefaults()}
                NavigationLink("Compare fair meeting places") {FairPointView(groupID:groupID)}
                InlineFailure(message:defaults.error)
            }}
            Section("When") { DatePicker("Starts",selection:$start); DatePicker("Ends",selection:$end,in:start...) }
            Section("Invite members") {
                Text("You’re included as the host. Choose who else should answer privately.").font(.footnote)
                ForEach(roster.value["members"].items.map(WireRow.init).filter {$0["profile_id"].text != app.profile["id"].text}) { r in
                    Toggle(r["profiles"]["display_name"].text,isOn:Binding(get:{participants.contains(r["profile_id"].text)},set:{ value in if value {participants.insert(r["profile_id"].text)} else {participants.remove(r["profile_id"].text)} }))
                }
            }
            Section { ActionButton(title:"Launch plan",workingTitle:"Launching…") {
                guard !groupID.isEmpty,!title.trimmingCharacters(in:.whitespaces).isEmpty,title.count <= 120,end > start else { throw ServiceFailure(message:"Choose a group, add a title and set an end after the start.") }
                _ = try await app.call("createPlan",["groupId":.string(groupID),"title":.string(title),"category":.string(category),"windowStart":.string(start.ISO8601Format()),"windowEnd":.string(end.ISO8601Format()),"locationArea":.string(area),"participantIds":.array(participants.sorted().map { .string($0) })]); dismiss()
            }.buttonStyle(.borderedProminent); InlineFailure(message:groups.error); InlineFailure(message:roster.error) }
        }.synclyList().navigationTitle("New plan")
        .toolbar { ToolbarItem(placement:.cancellationAction) { Button("Cancel") { dismiss() } } }
        .task { await groups.load(app,"listGroups"); groupID = initialGroupID.isEmpty ? groups.value.items.first?["id"].text ?? "" : initialGroupID }
         .task(id:groupID) {
            participants=[]
            if !groupID.isEmpty {
                await roster.load(app,"getGroup",["groupId":.string(groupID)])
                await defaults.load(app,"getPlanDefaults",["groupId":.string(groupID)])
                participants=Set(roster.value["members"].items.map {$0["profile_id"].text}.filter {$0 != app.profile["id"].text})
            }
        }
    }
    private func applyDefaults() throws {
        guard defaults.error == nil,defaults.value != .null else {throw ServiceFailure(message:"Saved defaults are unavailable. Choose a time and area manually.")}
        let suggested=defaults.value["suggestedWindow"]
        if let minutes=PlanningEngine.minutes(suggested["start"].text),let endMinutes=PlanningEngine.minutes(suggested["end"].text),let first=Calendar.current.date(bySettingHour:Int(minutes)/60,minute:Int(minutes)%60,second:0,of:start),let last=Calendar.current.date(bySettingHour:Int(endMinutes)/60,minute:Int(endMinutes)%60,second:0,of:first) {
            start=first;end=last>first ? last : last.addingTimeInterval(86400)
        }
        let fair=defaults.value["fairPoint"]["zip"].text
        area=fair.isEmpty ? defaults.value["me"]["zip"].text : fair
    }
}
struct PlanDetailView: View {
    let planID: String
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var constraints = false
    @State private var parentName=""
    @State private var parentEmail=""
    @State private var approvalLink:URL?
    private var plan: JSONValue { model.value["plan"] }
    private var open: Bool { PlanningHelpers.canEdit(plan["status"].text) }
    private var visibleOptions:[WireRow] {
        let options=model.value["recommendations"].items.map(WireRow.init)
        guard plan["status"].text == "finalized" else {return options}
        return options.filter {$0.id == plan["selected_recommendation_id"].text}
    }
    var body: some View {
        List {
            Section {
                VStack(alignment:.leading,spacing:10) {
                    DemoNotice();PlanRow(row:WireRow(value:plan))
                    Text("Private answers. Shared decisions.").font(.footnote).foregroundStyle(Theme.secondaryText)
                }
            }
            if let itinerary = try? plan["itinerary"].decoded(NativeItinerary.self) { Section("Itinerary") { ItineraryPlanView(itinerary:itinerary) } }
            if open {Section("Your answer") {Button("Your private answers",systemImage:"lock.fill") {constraints=true}}}
            Section("People") {
                ForEach(model.value["participants"].items.map(WireRow.init)) { r in HStack { Text(r["profiles"]["avatar_emoji"].text); Text(r["profiles"]["display_name"].text); Spacer(); Label(r["responded"].flag ? "Answered" : "Waiting",systemImage:r["responded"].flag ? "checkmark.circle" : "clock").font(.caption) } }
                if open {ActionButton(title:"I’m going") {_ = try await app.call("confirmAttendance",["planId":.string(planID),"attending":.bool(true)]);await reload()};ConfirmAction(title:"I can’t make it",detail:"Your attendance will be updated for this plan.") {_ = try await app.call("confirmAttendance",["planId":.string(planID),"attending":.bool(false)]);await reload()} }
                NavigationLink("Availability",destination:AvailabilityView(planID:planID))
            }
            Section(plan["status"].text == "finalized" ? "Locked-in plan" : "Compatible options") {
                ForEach(visibleOptions) { rec in
                    NavigationLink { RecommendationView(planID:planID,plan:plan,rec:rec.value,participants:model.value["participants"].items,onFinalized:{await reload()}) } label: {
                        VStack(alignment:.leading,spacing:5) { Text(rec["title"].text).font(.headline); Label(rec["feasible"].flag ? "Works for everyone · \(Int(rec["score"].number ?? 0))% match" : "Doesn’t meet every requirement",systemImage:rec["feasible"].flag ? "checkmark.shield" : "exclamationmark.circle").font(.caption).foregroundStyle(Theme.secondaryText); Text(CostEstimate.moneyRange(rec["cost_min"].number ?? 0,rec["cost_max"].number ?? 0)+" per person").font(.subheadline) }
                    }
                }
                if open { ActionButton(title:model.value["recommendations"].items.isEmpty ? "Find compatible options" : "Refresh options",workingTitle:"Finding options…") { _ = try await app.call("generateRecommendations",["planId":.string(planID)]); await reload() }.buttonStyle(.borderedProminent) }
            }
            Section("Rides") {
                ForEach(model.value["transport"].items.map(WireRow.init)) {ride in
                    VStack(alignment:.leading) {
                        Text(ride["car_label"].text).font(.headline);Text(ride["driver_label"].text)
                        if ride["driver_profile_id"].text == app.profile["id"].text {NavigationLink("Vehicle and departure") {RideDetailsView(assignment:ride.value)}}
                    }
                }
            }
            Section("Parent approval") {
                ForEach(model.value["approvals"].items.map(WireRow.init)) { r in Label(r["status"].text.capitalized,systemImage:r["status"].text == "approved" ? "checkmark.shield" : "clock"); if !r["condition_text"].text.isEmpty { Text(r["condition_text"].text) } }
                TextField("Parent name (optional)",text:$parentName)
                TextField("Parent email (optional)",text:$parentEmail).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                ActionButton(title:"Request parent approval") {
                    let result=try await app.call("requestParentApproval",["planId":.string(planID),"parentName":.string(parentName),"parentEmail":.string(parentEmail)])
                    if !result["token"].text.isEmpty {approvalLink=URL(string:"https://syncly.website/approve/"+result["token"].text)}
                    else {approvalLink=nil}
                    await reload()
                }
                if let approvalLink {ShareLink("Share private approval link with parent",item:approvalLink);Text("Anyone holding this link can respond. Share it only with your parent.").font(.caption)}
                Text(app.isDemo ? "Sample requests never send emails or alerts." : "Linked guardians answer in their family hub. Approval links are never shown to other group members.").font(.footnote).foregroundStyle(Theme.secondaryText)
            }
            Section { NavigationLink("Plan insights") {PlanInsightsView(planID:planID)};NavigationLink("Group chat") { ChatView(id:plan["group_id"].text,title:plan["title"].text,direct:false) }; NavigationLink("Conflicts and compromise") { ConflictView(planID:planID) } }
            InlineFailure(message:model.error)
            if model.loading { ProgressView() }
        }.synclyList().navigationTitle(plan["title"].text.isEmpty ? "Plan" : plan["title"].text).navigationBarTitleDisplayMode(.inline)
        .task { await reload() }.refreshable { await reload() }
        .sheet(isPresented:$constraints,onDismiss:{Task {await reload()}}) { NavigationStack { ConstraintFormView(planID:planID,initial:model.value["myConstraints"]) } }
    }
    private func reload() async { await model.load(app,"getPlan",["planId":.string(planID)]) }
}
struct RecommendationView: View {
    let planID: String
    let plan: JSONValue
    let rec: JSONValue
    let participants: [JSONValue]
    var onFinalized:(() async -> Void)? = nil
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var export = false
    private var venue: JSONValue {rec}
    var body: some View {
        List {
            Section {
                Text(rec["title"].text).font(.title.bold())
                Text(rec["subtitle"].text)
                Label(rec["location_name"].text,systemImage:"mappin");if !rec["address"].text.isEmpty {Text(rec["address"].text)}
                Text("\(rec["suggested_start"].text) – \(rec["suggested_end"].text)")
                Text(CostEstimate.moneyRange(rec["cost_min"].number ?? 0,rec["cost_max"].number ?? 0)+" per person")
                if let lat = venue["lat"].number,let lon = venue["lon"].number {
                    Map { Marker(rec["title"].text,coordinate:.init(latitude:lat,longitude:lon)) }.frame(height:220)
                    if let url = URL(string:"https://maps.apple.com/?daddr=\(lat),\(lon)") { Link("Directions in Maps",destination:url) }
                }
            }
            Section("Why it fits") { ForEach(rec["breakdown"]["reasons"].items.map(\.text),id:\.self) { Label($0,systemImage:"checkmark") }; ForEach(rec["breakdown"]["cautions"].items.map(\.text),id:\.self) { Label($0,systemImage:"exclamationmark.circle") } }
            if PlanningHelpers.canEdit(plan["status"].text),rec["feasible"].flag {
                Section {
                    ActionButton(title:"Vote for this option") { _ = try await app.call("castVote",["planId":.string(planID),"recommendationId":rec["id"]]) }
                    ConfirmAction(title:"Lock in this plan",detail:"Everyone will see the finalized plan. Private answers stay hidden.",role:nil) { _ = try await app.call("finalizePlan",["planId":.string(planID),"recommendationId":rec["id"]]); await onFinalized?(); dismiss() }
                }
            }
            Section {
                NavigationLink("Cost estimate",destination:CostView(rec:rec,category:plan["category"].text,headcount:participants.count))
                ShareLink("Share plan",item:"\(plan["title"].text)\n\(rec["title"].text) · \(rec["location_name"].text)\n\(rec["suggested_start"].text)–\(rec["suggested_end"].text)\nAbout \(CostEstimate.moneyRange(rec["cost_min"].number ?? 0,rec["cost_max"].number ?? 0)) per person\nPlanned with Syncly")
                Button("Export to Calendar") { export = true }
            }
        }.synclyList().navigationTitle("Plan details").navigationBarTitleDisplayMode(.inline)
        .fileExporter(isPresented:$export,document:CalendarDocument(plan:plan,rec:rec),contentType:UTType(filenameExtension:"ics") ?? .plainText,defaultFilename:"Syncly plan") { _ in }
    }
}
struct AvailabilityView: View {
    let planID: String
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    var body: some View { List { Section { Text("Only group totals are shown. Nobody’s individual schedule is shared.").font(.footnote); ForEach(model.value["cells"].items,id:\.self) { cell in HStack { Text(cell["slot"].text); Spacer(); Text("\(Int(cell["free"].number ?? 0)) of \(Int(cell["total"].number ?? 0)) free") } } }; InlineFailure(message:model.error) }.synclyList().navigationTitle("Availability").task { await model.load(app,"getAvailabilityHeatmap",["planId":.string(planID)]) } }
}
struct CostView: View {
    let rec: JSONValue
    let category: String
    let headcount: Int
    var body: some View {
        List {
            Section { Text("Estimate, not a charge or receipt. No payment is collected.").font(.footnote) }
            let option=PlanOption(key:rec["option_key"].text,title:rec["title"].text,subtitle:rec["subtitle"].text,category:[category],costMin:rec["cost_min"].number ?? 0,costMax:rec["cost_max"].number ?? 0,travelMinutes:rec["travel_minutes"].number ?? 0,start:rec["suggested_start"].text,end:rec["suggested_end"].text,location:rec["location_name"].text,tags:rec["tags"].items.map(\.text),dietaryFriendly:[],style:"",requiresDriving:rec["breakdown"].fields.keys.contains("requiresDriving") ? rec["breakdown"]["requiresDriving"].flag : true,distanceMiles:rec["breakdown"]["venue"]["distanceMiles"].number)
            let cost=CostEstimate.estimate(option:option,category:category,headcount:headcount)
            Section("Per person") {ForEach(cost.lines,id:\.0) {title,value in LabeledContent(title,value:value)};LabeledContent("Estimated total",value:CostEstimate.moneyRange(Double(cost.perPersonMin),Double(cost.perPersonMax)))}
            Section("Group") {LabeledContent("Estimated total",value:CostEstimate.moneyRange(Double(cost.groupMin),Double(cost.groupMax)))}
        }.synclyList().navigationTitle("Cost estimate")
    }
}
struct ConflictView: View {
    let planID: String
    @Environment(AppContainer.self) private var app
    @State private var conflicts = ResourceModel()
    @State private var summaries: JSONValue = .null
    @State private var suggestion: JSONValue = .null
    var body: some View {
        List {
            Section {Text("Compromise never relaxes a hard safety requirement. Individual answers stay private.")}
            Section("Flag a problem") {
                ForEach([("budget","Too expensive"),("curfew","Past curfew"),("distance","Too far"),("schedule","Time conflict")],id:\.0) {kind,label in
                    ActionButton(title:label) {_ = try await app.call("flagConflict",["planId":.string(planID),"kind":.string(kind)]);await reload()}
                }
            }
            Section("Open conflicts") {ForEach(conflicts.value["conflicts"].items.map(WireRow.init)) {r in Text(r["detail"].text.isEmpty ? r["kind"].text.capitalized : r["detail"].text)}}
            Section("Sync’s perspective") {
                ActionButton(title:"Explain the compromises",workingTitle:"Thinking…") {summaries = try await app.call("getCompromiseSummaries",["planId":.string(planID)])}
                ForEach(summaries.fields.keys.sorted(),id:\.self) {key in Text(summaries[key].text)}
                ActionButton(title:"Ask for a Plan B",workingTitle:"Thinking…") {suggestion = try await app.call("getPlanBSuggestion",["planId":.string(planID)])}
                if !suggestion["pitch"].text.isEmpty {Text(suggestion["pitch"].text)}
                if suggestion != .null,!suggestion["needed"].flag {Text("No Plan B is needed right now.")}
            }
            InlineFailure(message:conflicts.error)
        }.synclyList().navigationTitle("Conflicts and Plan B").task {await reload()}
    }
    private func reload() async {await conflicts.load(app,"getPlanConflicts",["planId":.string(planID)])}
}
struct MagicPlanView: View {
    init(groupID:String="",prompt:String="") {_groupID=State(initialValue:groupID);_prompt=State(initialValue:prompt)}
    @Environment(AppContainer.self) private var app
    @State private var groups = ResourceModel()
    @State private var groupID = ""
    @State private var prompt = ""
    @State private var launched: String?
    var body: some View { Form {
        Section("Your idea") { Picker("Group",selection:$groupID) { Text("Choose a group").tag(""); ForEach(groups.value.items.map(WireRow.init)) { r in Text(r["name"].text).tag(r.id) } }; TextField("Dinner and something fun Friday…",text:$prompt,axis:.vertical).lineLimit(3...6); Text("Sync creates a plan from your request and the group’s private defaults. Review it before finalizing.").font(.footnote) }
        Section { ActionButton(title:"Create with Sync",workingTitle:"Planning…") { guard !groupID.isEmpty,!prompt.trimmingCharacters(in:.whitespaces).isEmpty else { throw ServiceFailure(message:"Choose a group and describe your plan.") }; let result = try await app.call("launchAiPlan",["groupId":.string(groupID),"prompt":.string(prompt),"timeZone":.string(TimeZone.current.identifier)]); launched = result["planId"].text }; if let launched,!launched.isEmpty { NavigationLink("Review your plan") { PlanDetailView(planID:launched) } }; InlineFailure(message:groups.error) }
        if app.isDemo { Section { Text("The offline sample has no AI provider. Use the plan wizard to explore deterministic planning.") } }
    }.synclyList().navigationTitle("Magic plan").task { await groups.load(app,"listGroups");if groupID.isEmpty {groupID = groups.value.items.first?["id"].text ?? ""} } }
}
