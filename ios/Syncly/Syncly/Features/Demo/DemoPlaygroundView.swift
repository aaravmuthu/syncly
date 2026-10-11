import SwiftUI
import Observation

@Observable
final class DemoPlaygroundModel {
    var members: [DemoMember]
    let catalog: [PlanOption]
    var selected = "m1"
    private var history: [[DemoMember]] = []
    init() throws {members = try PlanningEngine.fixture("DemoMembers",as:[DemoMember].self); catalog = try PlanningEngine.fixture("OptionCatalog",as:[PlanOption].self)}
    var ranked: [OptionScore] {PlanningEngine.rank(catalog.filter {$0.category.contains("hangout")},members:members)}
    var current: DemoMember? {members.first {$0.id == selected}}
    var canUndo: Bool {!history.isEmpty}
    func patch(_ update: (inout PrivateConstraints)->Void) {
        guard let index = members.firstIndex(where: {$0.id == selected}) else {return}
        history.append(members); if history.count > 20 {history.removeFirst()}; update(&members[index].constraints)
    }
    func undo() {if let previous = history.popLast() {members = previous}}
    func reset() throws {history.append(members); members = try PlanningEngine.fixture("DemoMembers",as:[DemoMember].self)}
    func twist(_ kind: String) {
        selected = kind == "halal" ? "m1" : kind == "curfew" ? "m3" : "m4"
        patch {c in switch kind {case "halal": c.dietary = Array(Set((c.dietary ?? [])+["halal"])).sorted(); case "curfew":c.latestEnd = "20:30";default:c.maxSpend = 5}}
    }
}
struct DemoPlaygroundView: View {
    @State private var model: DemoPlaygroundModel?
    @State private var error: String?
    var body: some View {
        List {
            if let model {
                Section {Text("Sample friends · offline playground").font(.headline);Text("These are invented demo answers. In a real group you can only see your own answers.").font(.footnote)}
                Section("Try a change") {Button("I only eat halal") {model.twist("halal")};Button("I have to be home by 8:30") {model.twist("curfew")};Button("I can only spend $5") {model.twist("budget")}}
                if let top = model.ranked.first {
                    Section(top.feasible ? "Strongest match" : "Nothing fits everyone yet") {
                        Text(top.option.title).font(.title2.bold())
                        Text("\(top.score)% match").font(.headline).contentTransition(.numericText())
                        Text(top.option.subtitle)
                        ForEach(top.feasible ? top.reasons : top.cautions,id:\.self) {Text($0).font(.subheadline)}
                    }
                }
                Section("Sample friend") {
                    Picker("Whose sample answer",selection:Binding(get:{model.selected},set:{model.selected = $0})) {ForEach(model.members) {m in Text("\(m.emoji) \(m.name)").tag(m.id)}}
                    if let current = model.current {
                        LabeledContent("Maximum spend",value:"$\(Int(current.constraints.maxSpend ?? 0))")
                        Slider(value:Binding(get:{model.current?.constraints.maxSpend ?? 20},set:{value in model.patch {$0.maxSpend = value}}),in:0...80,step:1).accessibilityLabel("Sample spending limit")
                        Toggle("Needs a ride",isOn:Binding(get:{model.current?.constraints.needsRide ?? false},set:{value in model.patch {$0.needsRide = value}}))
                        Toggle("Can drive",isOn:Binding(get:{model.current?.constraints.canDrive ?? false},set:{value in model.patch {$0.canDrive = value}}))
                        ForEach(["vegetarian","vegan","gluten-free","halal","nut-free"],id:\.self) {tag in Toggle(tag,isOn:Binding(get:{model.current?.constraints.dietary?.contains(tag) ?? false},set:{on in model.patch {c in var values = Set(c.dietary ?? []);if on {values.insert(tag)} else {values.remove(tag)};c.dietary = values.sorted()}}))}
                    }
                }
                Section("All options") {ForEach(model.ranked) {r in HStack {VStack(alignment:.leading) {Text(r.option.title);Text(r.feasible ? "Works for everyone" : "Doesn’t fit everyone").font(.caption)};Spacer();Text("\(r.score)%").monospacedDigit()}}}
                Section {Button("Undo last change") {model.undo()}.disabled(!model.canUndo);ActionButton(title:"Reset sample") {try model.reset()}}
            }
            InlineFailure(message:error)
        }.synclyList().navigationTitle("Compatibility demo").task {do {model = try DemoPlaygroundModel()} catch {self.error = error.localizedDescription}}
    }
}
