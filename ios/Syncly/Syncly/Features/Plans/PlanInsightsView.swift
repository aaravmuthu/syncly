import SwiftUI

struct PlanInsightsView:View {
    let planID:String
    @Environment(AppContainer.self) private var app
    @State private var weather=ResourceModel()
    @State private var question=""
    @State private var answer:JSONValue = .null
    @State private var history:[JSONValue]=[]
    var body:some View {
        Form {
            Section("Forecast at the venue") {
                if weather.value != .null {Text(weather.value["emoji"].text + " " + weather.value["label"].text);Text("\(Int(weather.value["tempMaxF"].number ?? 0))° / \(Int(weather.value["tempMinF"].number ?? 0))° · \(Int(weather.value["precipProbability"].number ?? 0))% rain");if weather.value["alert"].flag {Label(weather.value["alertText"].text,systemImage:"exclamationmark.triangle")}}
                else if !weather.loading {Text("No forecast available yet")}
                InlineFailure(message:weather.error)
            }
            Section("Ask about this plan") {
                TextField("How is this plan coming together?",text:$question,axis:.vertical)
                ActionButton(title:"Ask Sync",workingTitle:"Thinking…") {
                    answer=try await app.call("askPlanConcierge",["planId":.string(planID),"question":.string(question),"history":.array(Array(history.suffix(8)))])
                    history.append(.object(["role":.string("user"),"content":.string(question)]));history.append(.object(["role":.string("assistant"),"content":answer["answer"]]))
                }
                if !answer["answer"].text.isEmpty {Text(answer["answer"].text)}
                Text("Sync uses group totals and public plan details. Suggestions need review before making a change.").font(.footnote)
            }
            PlanConciergeActionView(planID:planID,response:answer)
        }.synclyList().navigationTitle("Plan insights").task {await weather.load(app,"getPlanWeather",["planId":.string(planID)])}
    }
}
