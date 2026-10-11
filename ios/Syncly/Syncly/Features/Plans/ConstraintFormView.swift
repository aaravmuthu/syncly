import SwiftUI

struct ConstraintFormView: View {
    let planID: String
    let initial: JSONValue
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var constraints = PrivateConstraints()
    @State private var budget = ""
    @State private var totalBudget = ""
    @State private var allergies = ""
    @State private var disliked = ""
    @State private var styles = ""
    @State private var days = ""
    @State private var mode = "either"
    @State private var destinations = ""
    @State private var conditions = ""
    @State private var unavailable = ""
    @State private var ticket = ""
    @State private var travel = ""
    @State private var miles = ""
    @State private var zip = ""
    @State private var earliest = ""
    @State private var latest = ""
    @State private var home = ""
    @State private var notes = ""
    @State private var needsRide = false
    @State private var canDrive = false
    @State private var seats = 3
    @State private var approval = false
    @State private var dietary: Set<String> = []
    @State private var tags: Set<String> = []
    @State private var availability: Set<String> = []
    var body: some View {
        Form {
            Section { Label("Only you can see these answers",systemImage:"lock.shield"); Text("Your group sees the computed plan and compatibility, never your raw answers.").font(.footnote) }
            Section("Spending") { TextField("Maximum per person ($), optional",text:$budget).keyboardType(.decimalPad); TextField("Maximum ticket price ($), optional",text:$ticket).keyboardType(.decimalPad); TextField("Total budget ($), optional",text:$totalBudget).keyboardType(.decimalPad) }
            Section("Food and safety") { ForEach(["vegetarian","vegan","gluten-free","halal","nut-free"],id:\.self) { choice in selection(choice,in:$dietary) } }
            Section("What sounds good?") { ForEach(["active","indoor","outdoor","games","cozy","group","late-night"],id:\.self) { choice in selection(choice,in:$tags) } }
            Section("Other preferences and safety") {TextField("Allergies, separated by commas",text:$allergies);TextField("Disliked tags, separated by commas",text:$disliked);TextField("Venue styles, separated by commas",text:$styles)}
            Section("Trip preferences") {TextField("Maximum days, optional",text:$days).keyboardType(.numberPad);Picker("Travel mode",selection:$mode) {Text("Either").tag("either");Text("Drive").tag("drive");Text("Fly").tag("fly")};TextField("Destination types, separated by commas",text:$destinations)}
            Section("Travel and rides") {
                TextField("Maximum travel minutes, optional",text:$travel).keyboardType(.numberPad)
                TextField("Maximum distance miles, optional",text:$miles).keyboardType(.decimalPad)
                TextField("ZIP code, optional",text:$zip).keyboardType(.numberPad)
                Toggle("I need a ride",isOn:$needsRide); Toggle("I can drive",isOn:$canDrive)
                if canDrive { Stepper("Passenger seats: \(seats)",value:$seats,in:0...50) }
            }
            Section("Your schedule") {
                TextField("Earliest start (HH:MM), optional",text:$earliest).keyboardType(.numbersAndPunctuation)
                TextField("Latest end (HH:MM), optional",text:$latest).keyboardType(.numbersAndPunctuation)
                TextField("Home by (HH:MM), optional",text:$home).keyboardType(.numbersAndPunctuation)
                ForEach(PlanningHelpers.slots,id:\.self) { slot in selection(slot,in:$availability) }
            }
            Section("Parent and other needs") { Toggle("Parent approval required",isOn:$approval); TextField("Parent conditions, separated by commas",text:$conditions);TextField("Unavailable dates (YYYY-MM-DD), separated by commas",text:$unavailable);TextField("Anything else? (optional)",text:$notes,axis:.vertical).lineLimit(3...6) }
            Section { ActionButton(title:"Save private answers",workingTitle:"Saving…") {
                var c = constraints
                c.totalBudget = try amount(totalBudget,max:1000000);c.maxDays = try amount(days,max:365);c.travelMode = mode;c.allergies = try list(allergies);c.dislikedTags = try list(disliked);c.venueStyle = try list(styles);c.destinationTypes = try list(destinations);c.parentConditions = try list(conditions,maxItems:20,maxLength:200);c.unavailableDates = try list(unavailable,maxItems:366,maxLength:40)
                c.maxSpend = try amount(budget,max:100000); c.maxTicketPrice = try amount(ticket,max:100000); c.maxTravelMinutes = try amount(travel,max:1440); c.maxDistanceMiles = try amount(miles,max:5000)
                c.earliestStart = try clock(earliest); c.latestEnd = try clock(latest); c.requiredReturnTime = try clock(home)
                c.dietary = dietary.sorted(); c.likedTags = tags.sorted(); c.availability = availability.sorted()
                c.needsRide = needsRide; c.canDrive = canDrive; c.seats = Double(seats); c.parentApprovalRequired = approval; c.zipCode = zip; c.notes = notes
                guard notes.count <= 1000,zip.count <= 10 else { throw ServiceFailure(message:"Shorten your note or ZIP code.") }
                _ = try await app.call("submitConstraints",["planId":.string(planID),"payload":try JSONValue.encoded(c)]); dismiss()
            }.buttonStyle(.borderedProminent) }
        }.synclyList().navigationTitle("Your private answers").toolbar { ToolbarItem(placement:.cancellationAction) { Button("Cancel") { dismiss() } } }
        .onAppear {
            constraints = (try? initial.decoded(PrivateConstraints.self)) ?? PrivateConstraints()
            let c = constraints
            totalBudget=c.totalBudget.map {String($0)} ?? "";days=c.maxDays.map {String($0)} ?? "";mode=c.travelMode ?? "either";allergies=(c.allergies ?? []).joined(separator:", ");disliked=(c.dislikedTags ?? []).joined(separator:", ");styles=(c.venueStyle ?? []).joined(separator:", ");destinations=(c.destinationTypes ?? []).joined(separator:", ");conditions=(c.parentConditions ?? []).joined(separator:", ");unavailable=(c.unavailableDates ?? []).joined(separator:", ")
            budget = c.maxSpend.map {String($0)} ?? ""; ticket = c.maxTicketPrice.map {String($0)} ?? ""; travel = c.maxTravelMinutes.map {String($0)} ?? ""; miles = c.maxDistanceMiles.map {String($0)} ?? ""
            earliest = c.earliestStart ?? ""; latest = c.latestEnd ?? ""; home = c.requiredReturnTime ?? ""; zip = c.zipCode ?? ""; notes = c.notes ?? ""
            needsRide = c.needsRide ?? false; canDrive = c.canDrive ?? false; seats = Int(c.seats ?? 3); approval = c.parentApprovalRequired ?? false
            dietary = Set(c.dietary ?? []); tags = Set(c.likedTags ?? []); availability = Set(c.availability ?? [])
        }
    }
    private func selection(_ title: String,in values: Binding<Set<String>>) -> some View {
        Toggle(title,isOn:Binding(get:{values.wrappedValue.contains(title)},set:{on in if on {values.wrappedValue.insert(title)} else {values.wrappedValue.remove(title)} }))
    }
    private func list(_ text:String,maxItems:Int = 30,maxLength:Int = 60) throws -> [String] {
        let values = text.split(separator:",").map { $0.trimmingCharacters(in:.whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard values.count <= maxItems,values.allSatisfy({$0.count <= maxLength}) else {throw ServiceFailure(message:"Shorten the list and try again.")}
        return values
    }
    private func amount(_ text: String,max: Double) throws -> Double? {
        guard !text.trimmingCharacters(in:.whitespaces).isEmpty else { return nil }
        guard let value = Double(text),value.isFinite,(0...max).contains(value) else { throw ServiceFailure(message:"Enter a number between 0 and \(Int(max)).") }; return value
    }
    private func clock(_ text: String) throws -> String? {
        guard !text.isEmpty else { return nil }
        guard text.range(of:"^([01][0-9]|2[0-3]):[0-5][0-9]$",options:.regularExpression) != nil else { throw ServiceFailure(message:"Enter times as HH:MM, such as 18:30.") }; return text
    }
}
