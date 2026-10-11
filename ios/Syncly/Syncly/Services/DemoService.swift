import Foundation

/// Entirely isolated offline data. No live client, permissions, uploads or notifications.
actor DemoService: SynclyService {
    private var members: [DemoMember]
    private let catalog: [PlanOption]
    private var groups: [JSONValue] = []
    private var plans: [JSONValue] = []
    private var messages: [String:[JSONValue]] = [:]
    private var recommendations: [String:[JSONValue]] = [:]
    private var mine: [String:PrivateConstraints] = [:]
    private var activity: [JSONValue] = []
    private var votes: [String:String] = [:]
    private var profile: JSONValue
    private var sharing = false
    private var familyPlus = false
    private var trialUsed=false
    private var familyStatus="free"
    private var familyInterval="month"
    private var familyPeriodEnd:Date?
    private var approvals:[String:JSONValue]=[:]
    private var attendance:[String:Bool]=[:]
    private var linkRequests: [JSONValue] = []
    private var guardianLinked = true
    private var checkins:[JSONValue]=[]
    private var reactions:[JSONValue]=[]
    private var aliases:[String:String]=[:]
    private var participants:[String:[String]] = [:]
    static let groupID = "10000000-0000-4000-8000-000000000001"
    static let planID = "10000000-0000-4000-8000-000000000002"
    static let myID = "10000000-0000-4000-8000-000000000003"
    init() throws {
        members = try PlanningEngine.fixture("DemoMembers",as:[DemoMember].self)
        catalog = try PlanningEngine.fixture("OptionCatalog",as:[PlanOption].self)
        profile = .object(["id":.string(Self.myID),"display_name":.string("Maya"),"avatar_emoji":.string("🌿"),"onboarded":.bool(true),"account_type":.string("teen"),"hasLinkedTeens":.bool(true)])
        groups = [.object(["id":.string(Self.groupID),"name":.string("Friday crew"),"emoji":.string("🌿"),"invite_code":.string("SYNCLYDEMO"),"role":.string("owner"),"kind":.string("permanent"),"created_by":.string(Self.myID),"member_count":.number(4)])]
        plans = [.object(["id":.string(Self.planID),"group_id":.string(Self.groupID),"created_by":.string(Self.myID),"title":.string("Friday hangout"),"category":.string("hangout"),"status":.string("collecting"),"window_start":.string(Self.futureTime),"location_area":.string("Old Town")])]
        mine[Self.planID]=members.first?.constraints
        approvals[Self.planID] = .object(["id":.string("demo-approval-"+Self.planID),"profile_id":.string(Self.myID),"status":.string("pending"),"condition_text":.null,"decided_via":.null])
        messages[Self.groupID] = [.object(["id":.string(UUID().uuidString),"sender_id":.string("sample-dev"),"content":.string("What works for everyone this Friday?"),"profiles":.object(["display_name":.string("Dev"),"avatar_emoji":.string("🎧")]),"created_at":.string(Date().ISO8601Format())])]
    }
    private static var futureTime: String { Date().addingTimeInterval(86400).ISO8601Format() }
    private func obj(_ values: [String:JSONValue]) -> JSONValue { .object(values) }
    private func record(_ message: String) {
        activity.insert(obj(["id":.string(UUID().uuidString),"message":.string(message),"title":.string(message),"created_at":.string(Date().ISO8601Format())]),at:0)
    }
    private func updatePlan(_ id: String,_ patch: [String:JSONValue]) throws {
        guard let index = plans.firstIndex(where: { $0["id"].text == id }) else { throw ServiceFailure(message:"That plan is unavailable.") }
        var fields = plans[index].fields; fields.merge(patch) { _,new in new }; plans[index] = obj(fields)
    }
    private func roster(groupID:String = DemoService.groupID, planID:String? = nil) -> [JSONValue] {
        let rows = members.enumerated().map { i,m in obj(["profile_id":.string(i == 0 ? Self.myID : m.id),"role":.string(i == 0 ? "owner" : "member"),"responded":.bool(true),"attending":.bool(i == 0 ? attendance[planID ?? ""] ?? true : true),"profiles":obj(["id":.string(i == 0 ? Self.myID : m.id),"display_name":.string(m.name),"avatar_emoji":.string(m.emoji)])]) }
        if let planID,let selected=participants[planID] {return rows.filter {selected.contains($0["profile_id"].text)}}
        return groupID == Self.groupID ? rows : Array(rows.prefix(1))
    }
    func call(_ operation: String, _ input: JSONValue) async throws -> JSONValue {
        let planID = input["planId"].text, groupID = input["groupId"].text
        switch operation {
        case "getMe": return profile
        case "getSquadDigest":return obj(["headline":.string("Your sample week"),"bullets":.array(plans.map {.string($0["title"].text+" · "+$0["status"].text)}),"nextBest":.string("Ask your sample group for private answers to get started."),"aiGenerated":.bool(false)])
        case "getPlanDefaults":return obj(["summary":.string("Sample group defaults, stored on this device only"),"suggestedWindow":obj(["start":.string("18:00"),"end":.string("20:00")]),"me":obj(["profileId":.string(Self.myID),"zip":.null]),"fairPoint":.null])
        case "getEmailSecurity": return obj(["enabled":.bool(false),"verified":.bool(true),"requiresPassword":.bool(false)])
        case "saveProfile":
            var fields = profile.fields; fields.merge(input.fields) { _,new in new }; profile = obj(fields); record("Your profile was updated"); return profile
        case "acceptTerms": return obj(["ok":.bool(true)])
        case "listGroups": return .array(groups)
        case "getGroup":
            guard let group = groups.first(where: { $0["id"].text == groupID }) else { throw ServiceFailure(message:"That group is unavailable.") }
            return obj(["group":group,"members":.array(roster(groupID:groupID)),"plans":.array(plans.filter { $0["group_id"].text == groupID }),"activity":.array(activity),"myProfileId":.string(Self.myID)])
        case "createGroup":
            let name = input["name"].text.trimmingCharacters(in:.whitespacesAndNewlines)
            guard !name.isEmpty,name.count <= 80 else { throw ServiceFailure(message:"Enter a group name up to 80 characters.") }
            let group = obj(["id":.string(UUID().uuidString),"name":.string(name),"emoji":input["emoji"],"invite_code":.string("DEMO"+String(UUID().uuidString.filter {$0 != "-"}.prefix(8))),"member_count":.number(1),"role":.string("owner"),"created_by":.string(Self.myID),"kind":input["kind"]]); groups.append(group); record("\(name) was created"); return group
        case "joinGroup":
            let code = PlanningHelpers.inviteCode(input["code"].text)
            guard let group = groups.first(where: {$0["invite_code"].text == code}) else { throw ServiceFailure(message:"Try SYNCLYDEMO in the offline sample. Real invites need a live connection.") }; return group
        case "updateGroupLook":
            guard let index = groups.firstIndex(where: {$0["id"].text == groupID}) else { throw ServiceFailure(message:"That group is unavailable.") }
            var fields = groups[index].fields; fields.merge(input.fields.filter {$0.key != "groupId"}) { _,new in new }; groups[index] = obj(fields); return obj(["ok":.bool(true)])
        case "deleteGroup", "leaveGroup": groups.removeAll {$0["id"].text == groupID}; plans.removeAll {$0["group_id"].text == groupID}; return obj(["ok":.bool(true)])
        case "listPlans": return .array(plans)
        case "getDashboard": return obj(["myProfileId":.string(Self.myID),"plans":.array(plans)])
        case "createPlan":
            guard groups.contains(where: {$0["id"].text == groupID}), !input["title"].text.trimmingCharacters(in:.whitespaces).isEmpty else { throw ServiceFailure(message:"Choose a group and enter a title.") }
            let plan = obj(["id":.string(UUID().uuidString),"group_id":.string(groupID),"created_by":.string(Self.myID),"title":input["title"],"category":input["category"],"window_start":input["windowStart"],"window_end":input["windowEnd"],"location_area":input["locationArea"],"status":.string("collecting")]); participants[plan["id"].text] = [Self.myID] + input["participantIds"].items.map(\.text).filter {$0 != Self.myID};plans.insert(plan,at:0); record("A new plan needs private answers"); return plan
        case "getPlan":
            guard let plan = plans.first(where: {$0["id"].text == planID}) else { throw ServiceFailure(message:"That plan is unavailable.") }
            return obj(["plan":plan,"meProfileId":.string(Self.myID),"participants":.array(roster(groupID:plan["group_id"].text,planID:planID)),"recommendations":.array(recommendations[planID] ?? []),"myConstraints":try mine[planID].map {try JSONValue.encoded($0)} ?? .null,"votes":votes[planID].map { .array([obj(["profile_id":.string(Self.myID),"recommendation_id":.string($0)])]) } ?? .array([]),"transport":.array([]),"approvals":.array(approvals[planID].map {[$0]} ?? [])])
        case "submitConstraints":
            guard let plan = plans.first(where: {$0["id"].text == planID}), PlanningHelpers.canEdit(plan["status"].text) else { throw ServiceFailure(message:"This plan is closed for changes.") }
            let c = try input["payload"].decoded(PrivateConstraints.self)
            if let v = c.maxSpend, !v.isFinite || v < 0 || v > 100000 { throw ServiceFailure(message:"Enter a valid budget.") }
            mine[planID] = c; recommendations[planID] = []; votes[planID] = nil; try updatePlan(planID,["status":.string("collecting"),"selected_recommendation_id":.null]); record("Someone submitted private answers"); return obj(["ok":.bool(true)])
        case "generateRecommendations":
            guard let plan = plans.first(where: {$0["id"].text == planID}),PlanningHelpers.canEdit(plan["status"].text) else { throw ServiceFailure(message:"This plan is closed for changes.") }
            let selected=Set(roster(groupID:plan["group_id"].text,planID:planID).filter {$0["attending"].flag}.map {$0["profile_id"].text})
            var inputs = members.enumerated().filter {selected.contains($0.offset == 0 ? Self.myID : $0.element.id)}.map(\.element)
            if let c = mine[planID], !inputs.isEmpty { inputs[0].constraints = c }
            let ranked = PlanningEngine.rank(PlanningEngine.options(catalog,category:plan["category"].text),members:inputs)
            let rows = ranked.prefix(3).enumerated().map { i,r in obj(["id":.string(UUID().uuidString),"title":.string(r.option.title),"subtitle":.string(r.option.subtitle),"score":.number(Double(r.score)),"feasible":.bool(r.feasible),"rank":.number(Double(i+1)),"cost_min":.number(r.option.costMin),"cost_max":.number(r.option.costMax),"travel_minutes":.number(r.option.travelMinutes),"suggested_start":.string(r.option.start),"suggested_end":.string(r.option.end),"location_name":.string(r.option.location),"option_key":.string(r.option.key),"breakdown":obj(["overallFit":.number(Double(r.overallFit)),"fairness":.number(Double(r.fairness)),"requiresDriving":.bool(r.option.requiresDriving),"reasons":.array(r.reasons.map { .string($0) }),"cautions":.array(r.cautions.map { .string($0) })])]) }
            recommendations[planID] = rows; try updatePlan(planID,["status":.string("voting")]); record("Compatible options are ready"); return .array(rows)
        case "castVote", "finalizePlan":
            let id = input["recommendationId"].text
            guard let plan = plans.first(where: {$0["id"].text == planID}), PlanningHelpers.canEdit(plan["status"].text), let rec = recommendations[planID]?.first(where: {$0["id"].text == id}),rec["feasible"].flag else { throw ServiceFailure(message:"Choose an available option that works for everyone.") }
            if operation == "castVote" { votes[planID] = id; record("A vote was cast") }
            else { try updatePlan(planID,["status":.string("finalized"),"selected_recommendation_id":.string(id)]); record("The plan is locked in") }
            return obj(["ok":.bool(true)])
        case "getAvailabilityHeatmap":
            guard let plan=plans.first(where:{$0["id"].text == planID}) else {throw ServiceFailure(message:"This sample plan is unavailable.")}
            let selected=Set(roster(groupID:plan["group_id"].text,planID:planID).filter {$0["attending"].flag}.map {$0["profile_id"].text})
            let attending=members.enumerated().filter {selected.contains($0.offset == 0 ? Self.myID : $0.element.id)}.map {index,member in index == 0 ? mine[planID] ?? member.constraints : member.constraints}
            let marked=attending.filter {!($0.availability ?? []).isEmpty}
            let cells=PlanningHelpers.slots.map {slot in obj(["slot":.string(slot),"free":.number(Double(marked.filter {($0.availability ?? []).contains(slot)}.count)),"total":.number(Double(attending.count))])}
            return obj(["cells":.array(cells),"answered":.number(Double(marked.count)),"total":.number(Double(attending.count))])
        case "listActivity", "listNotifications": return .array(activity)
        case "markNotificationsRead":
            let ids=input["ids"].items.map(\.text)
            activity=activity.map { entry in
                guard ids.isEmpty || ids.contains(entry["id"].text),case .object(var fields)=entry else {return entry}
                fields["read"] = .bool(true);return .object(fields)
            }
            return obj(["ok":.bool(true)])
        case "markRead", "markThreadRead", "markAlertsRead": return obj(["ok":.bool(true)])
        case "listInbox": return obj(["me":.string(Self.myID),"squads":.array(groups.map { obj(["id":$0["id"],"name":$0["name"],"emoji":$0["emoji"],"unread":.number(0)]) }),"threads":.array([obj(["id":.string("demo-dm"),"peer":obj(["display_name":.string("Dev"),"avatar_emoji":.string("🎧")]),"unread":.number(0)])])])
        case "listMessages": return obj(["me":.string(Self.myID),"hostId":.string(Self.myID),"messages":.array(messages[groupID] ?? []),"reads":.array([])])
        case "getThread": return obj(["me":.string(Self.myID),"peer":obj(["display_name":.string("Dev")]),"messages":.array(messages[input["threadId"].text] ?? []),"reactions":.array(reactions)])
        case "sendMessage", "sendDirect":
            let content = input["content"].text.trimmingCharacters(in:.whitespacesAndNewlines)
            guard !content.isEmpty,content.count <= 2000 else { throw ServiceFailure(message:"Enter a message up to 2,000 characters.") }
            let key = operation == "sendMessage" ? groupID : input["threadId"].text
            let row = obj(["id":.string(UUID().uuidString),"sender_id":.string(Self.myID),"content":.string(content),"created_at":.string(Date().ISO8601Format()),"profiles":profile,"reply_to":messages[key]?.first(where:{$0["id"] == input["replyToId"]}) ?? .null]); messages[key,default:[]].append(row); return row
        case "listContacts":return .array(members.dropFirst().map {obj(["id":.string($0.id),"name":.string($0.name),"circles":.array([.string("Friday crew")])])})
        case "toggleReaction":
            let r=obj(["message_id":input["messageId"],"profile_id":.string(Self.myID),"emoji":input["emoji"]]);if reactions.contains(r) {reactions.removeAll {$0 == r}} else {reactions.append(r)};return obj(["ok":.bool(true)])
        case "getMyCheckins":return .array(checkins.filter {$0["status"].text == "pending"})
        case "askForCheckin":
            checkins.append(obj(["id":.string(UUID().uuidString),"status":.string("pending"),"note":input["note"],"created_at":.string(Date().ISO8601Format())]));return obj(["ok":.bool(true)])
        case "respondToCheckin":
            guard let index=checkins.firstIndex(where:{$0["id"] == input["id"] && $0["status"].text == "pending"}) else {throw ServiceFailure(message:"This check-in is no longer pending.")};var fields=checkins[index].fields;fields["status"] = .string("responded");fields["place_label"]=input["placeLabel"];fields["responded_at"] = .string(Date().ISO8601Format());checkins[index]=obj(fields);return obj(["ok":.bool(true)])
        case "getFriendProfile":
            guard let member=members.first(where:{$0.id == input["profileId"].text || ($0.id == members.first?.id && input["profileId"].text == Self.myID)}) else {throw ServiceFailure(message:"This sample contact is unavailable.")}
            return obj(["profileId":input["profileId"],"name":.string(member.name),"nickname":.string(aliases[input["profileId"].text] ?? ""),"emoji":.string(member.emoji),"bio":.string("Sample friend in the offline demo"),"circles":.array([obj(["id":.string(Self.groupID),"name":.string("Friday crew")])]),"upcoming":.array(plans),"telemetry":.null])
        case "requestLocation","setContactGhost":record("Sample contact preference recorded locally");return obj(["ok":.bool(true)])
        case "getPlanWeather":return .null
        case "confirmAttendance":attendance[planID]=input["attending"].flag;record(input["attending"].flag ? "Sample attendance confirmed" : "Sample attendance declined");return obj(["ok":.bool(true)])
        case "getNicknames":return obj(aliases.mapValues { .string($0) })
        case "setNickname":aliases[input["profileId"].text]=input["nickname"].text;return obj(["ok":.bool(true)])
        case "openThread": return obj(["threadId":.string("demo-dm")])
        case "getMyRadar": return obj(["me":obj(["id":.string(Self.myID),"name":profile["display_name"],"sharing":.bool(sharing)]),"zones":.array([]),"lastPing":.null,"guardians":.number(1)])
        case "getFriendPins": return .array([])
        case "setLocationSharing": sharing = input["enabled"].flag; return obj(["ok":.bool(true)])
        case "arrivedSafely", "sendDelay", "raiseSos": record("Sample family update recorded on this device only"); return obj(["ok":.bool(true)])
        case "getMySyncCode": return .string("DEMO123")
        case "getMyGuardians": guard guardianLinked else { return .array([]) }; return .array([obj(["id":.string("demo-link"),"relation":.string("Parent"),"guardian":obj(["display_name":.string("Sample parent"),"avatar_emoji":.string("👋")])])])
        case "getMyLinkRequests": return .array(linkRequests)
        case "getGuardianHub":
            guard guardianLinked else {return obj(["teens":.array([]),"alerts":.array([])])}
            let sharedPlans=plans.filter {attendance[$0["id"].text] != false}.map {p in var f=p.fields;f["approval"]=approvals[p["id"].text] ?? .null;return obj(f)}
            return obj(["teens":.array([obj(["id":.string(Self.myID),"name":.string("Maya"),"emoji":.string("🌿"),"sharing":.bool(false),"location":.null,"plans":.array(sharedPlans),"zones":.array([]),"checkins":.array(checkins)])]),"alerts":.array([])])
        case "linkTeen":
            guard input["code"].text.uppercased() == "DEMO123" else { throw ServiceFailure(message:"Use the sample teen’s Sync code: DEMO123.") }
            if guardianLinked {return obj(["teenId":.string(Self.myID),"teenName":.string("Sample teen"),"status":.string("linked")])}
            linkRequests = [obj(["id":.string(UUID().uuidString),"guardian":obj(["display_name":.string("Sample parent"),"avatar_emoji":.string("👋")])])]
            return obj(["teenName":.string("Sample teen"),"status":.string("pending")])
        case "answerLinkRequest":
            guard linkRequests.contains(where: {$0["id"] == input["requestId"]}) else { throw ServiceFailure(message:"That request is no longer waiting on you.") }
            linkRequests.removeAll {$0["id"] == input["requestId"]}; if input["approve"].flag { guardianLinked = true }; return obj(["approved":input["approve"]])
        case "unlinkGuardian": guardianLinked = false; sharing = false; return obj(["ok":.bool(true)])
        case "decidePlanApproval":
            guard guardianLinked,let target=approvals.first(where:{$0.value["id"] == input["approvalId"]}) else {throw ServiceFailure(message:"This sample approval is unavailable.")}
            let decision=input["decision"].text
            guard ["approved","approved_with_condition","declined"].contains(decision) else {throw ServiceFailure(message:"Choose a valid decision.")}
            if decision == "approved_with_condition",input["condition"].text.trimmingCharacters(in:.whitespaces).isEmpty {throw ServiceFailure(message:"Enter a condition first.")}
            var fields=target.value.fields;fields["status"] = .string(decision);fields["condition_text"]=input["condition"];fields["decided_via"] = .string("guardian");approvals[target.key]=obj(fields);record("Sample parent decision saved");return obj(["ok":.bool(true)])
        case "requestParentApproval":
            guard plans.contains(where:{$0["id"].text == planID}) else {throw ServiceFailure(message:"This sample plan is unavailable.")}
            let approval=obj(["id":.string("demo-approval-"+planID),"profile_id":.string(Self.myID),"status":.string("pending"),"condition_text":.null,"decided_via":.null]);approvals[planID]=approval;record("Sample approval requested — no email was sent");return obj(["id":approval["id"],"sentToGuardian":.bool(guardianLinked),"token":.null])
        case "getMyFamilyPlan":return obj(["tier":.string(familyPlus ? "plus" : "free"),"familyTier":.string(familyPlus ? "plus" : "free"),"status":.string(familyStatus),"interval":.string(familyInterval),"periodEnd":familyPeriodEnd.map {.string($0.ISO8601Format())} ?? .null,"trialAvailable":.bool(!trialUsed)])
        case "startFamilyPlus":guard !trialUsed else {throw ServiceFailure(message:"The sample founding-family trial has already been used.")};trialUsed=true;familyPlus=true;familyStatus="trialing";familyInterval=input["interval"].text;familyPeriodEnd=Calendar.current.date(byAdding:.month,value:6,to:.now);return obj(["tier":.string("plus"),"status":.string("trialing")])
        case "cancelFamilyPlus":familyStatus="canceled";return obj(["tier":.string(familyPlus ? "plus" : "free"),"status":.string("canceled")])
        case "exportAccountData": return obj(["version":.number(1),"profile":profile,"records":obj(["groups":.array(groups),"plans":.array(plans)])])
        default: throw ServiceFailure(message:"This feature needs the live connection. The offline sample does not simulate this action.")
        }
    }
}
