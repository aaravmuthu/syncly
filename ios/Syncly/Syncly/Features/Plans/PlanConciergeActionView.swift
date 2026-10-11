import SwiftUI

struct PlanConciergeActionView:View {
    let planID:String
    let response:JSONValue
    @Environment(AppContainer.self) private var app
    private var action:JSONValue {response["action"]}
    var body:some View {
        if action != .null {Section("Suggested action") {
            switch action["type"].text {
            case "cast_vote":
                Text(action["recommendationTitle"].text)
                ConfirmAction(title:"Cast my vote",detail:"This casts your own vote for the suggested option.",role:nil) {_ = try await app.call("castVote",["planId":.string(planID),"recommendationId":action["recommendationId"]])}
            case "select_option":
                Text(action["recommendationTitle"].text)
                if response["isHost"].flag {ConfirmAction(title:"Lock in suggested option",detail:"Review the option before locking in this plan for the group.",role:nil) {_ = try await app.call("finalizePlan",["planId":.string(planID),"recommendationId":action["recommendationId"]])}}
                else {Text("Ask your host to review this option.")}
            case "send_nudge":
                Text(action["message"].text)
                ConfirmAction(title:"Send this group reminder",detail:"This message will be sent to the group chat.",role:nil) {_ = try await app.call("sendMessage",["groupId":response["groupId"],"planId":.string(planID),"content":action["message"]])}
            case "change_time":
                Text("Suggested start: " + action["newStartTime"].text);Text(action["reason"].text)
                Text("The host must recheck everyone’s safety requirements before changing this time.").font(.footnote)
            default:Text("Review this suggestion with your group.")
            }
        }}
    }
}
