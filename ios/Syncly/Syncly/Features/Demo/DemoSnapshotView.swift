#if DEBUG
import SwiftUI

/// Deterministic, offline entry points for inspecting the actual native screens.
struct DemoSnapshotView:View {
    let route:String
    @Environment(AppContainer.self) private var app
    @State private var plan:JSONValue = .null
    @State private var teen:JSONValue = .null
    @State private var error:String?
    static var requestedRoute:String? {
        let args=ProcessInfo.processInfo.arguments
        guard args.contains("--demo"),let index=args.firstIndex(of:"--snapshot-route"),index+1<args.count else {return nil}
        return args[index+1]
    }
    var body:some View {
        NavigationStack {
            Group {
                switch route {
                case "group":GroupDetailView(groupID:DemoService.groupID)
                case "create-group":GroupFormView()
                case "join":JoinGroupView()
                case "wizard":PlanWizardView()
                case "plan":PlanDetailView(planID:DemoService.planID)
                case "answers":ConstraintFormView(planID:DemoService.planID,initial:.null)
                case "recommendation":if let rec=plan["recommendations"].items.first {RecommendationView(planID:DemoService.planID,plan:plan["plan"],rec:rec,participants:plan["participants"].items)} else {ProgressView()}
                case "chat":ChatView(id:DemoService.groupID,title:"Friday crew",direct:false)
                case "dm":ChatView(id:"demo-dm",title:"Dev",direct:true)
                case "activity":ActivityView()
                case "checkins":CheckinsView()
                case "home-area":HomeLocationSettingsView()
                case "approval":if let approvalPlan=teen["plans"].items.first,approvalPlan["approval"] != .null {GuardianApprovalView(plan:approvalPlan)} else {ProgressView()}
                case "family":FamilyHubView()
                case "teen":if teen != .null {TeenDetailView(teen:teen)} else {ProgressView()}
                case "guardian-links":GuardianLinksView()
                case "family-plus":FamilyPlusView()
                case "settings":SettingsView()
                case "profile":ProfileSettingsView()
                case "planning-settings":PlanningSettingsView()
                case "account":AccountSettingsView()
                case "playground":DemoPlaygroundView()
                case "itinerary":ItineraryBuilderView()
                case "spots":SpotsView()
                default:ContentUnavailableView("Unknown sample screen",systemImage:"questionmark")
                }
            }
            InlineFailure(message:error)
        }.task {
            do {
                if route == "checkins" {_ = try await app.call("askForCheckin",["teenProfileId":.string(DemoService.myID),"note":.string("Let me know when you arrive.")])}
                _ = try await app.call("generateRecommendations",["planId":.string(DemoService.planID)])
                plan=try await app.call("getPlan",["planId":.string(DemoService.planID)])
                let hub=try await app.call("getGuardianHub");teen=hub["teens"].items.first ?? .null
            } catch {self.error=error.localizedDescription}
        }
    }
}
#endif
