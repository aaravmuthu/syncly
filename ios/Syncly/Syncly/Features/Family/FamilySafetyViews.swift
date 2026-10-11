import SwiftUI

struct ParentPhoneLink: View {
    let phone: String
    var body: some View {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        if !digits.isEmpty, let url = URL(string:"tel:" + digits) { Link("Call " + phone, destination:url) }
        else { Text("Contact details are private").font(.caption).foregroundStyle(.secondary) }
    }
}
struct GuardianRideView: View {
    let ride: JSONValue
    var body: some View {
        VStack(alignment:.leading,spacing:4) {
            Text("\(ride["car_label"].text) · \(ride["driver_name"].text)").font(.headline)
            Text(ride["leg"].text == "back" ? "Return ride" : "Ride there")
            if ride["carries_my_teen"].flag { Label("Your teen is in this car",systemImage:"person.crop.circle.badge.checkmark") }
            if !ride["vehicle"].text.isEmpty { Text(ride["vehicle"].text) }
            if !ride["plate"].text.isEmpty { Text("Plate: " + ride["plate"].text) }
            if ride["departed_at"].text.isEmpty {Text("Hasn’t left yet")} else {LabeledContent("Left") {WireDateText(value:ride["departed_at"].text)}}
            if let eta=ride["eta_minutes"].number { Text("About \(Int(eta)) minutes away") }
            ParentPhoneLink(phone:ride["driver_phone"].text)
        }
    }
}
struct CheckinsView: View {
    @Environment(AppContainer.self) private var app
    @State private var model=ResourceModel()
    @State private var place=""
    var body: some View {
        Form {
            Section { Text("Reply to a guardian’s check-in request. A text reply does not turn on location sharing.");TextField("Where are you? (optional)",text:$place) }
            Section("Pending check-ins") {
                ForEach(model.value.items.map(WireRow.init)) {r in
                    VStack(alignment:.leading) {
                        Text(r["note"].text.isEmpty ? "Your guardian asked for a check-in" : r["note"].text)
                        WireDateText(value:r["created_at"].text).font(.caption)
                        ActionButton(title:"Reply: I’m okay") {
                            _ = try await app.call("respondToCheckin",["id":r["id"],"placeLabel":.string(place),"lat":.null,"lon":.null]);await reload()
                        }
                    }
                }
                if model.value.items.isEmpty,!model.loading {Text("No pending requests")}
            }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Check-ins").task {await reload()}.refreshable {await reload()}
    }
    private func reload() async {await model.load(app,"getMyCheckins")}
}
struct RideDetailsView: View {
    let assignment:JSONValue
    @Environment(AppContainer.self) private var app
    @State private var description=""
    @State private var color=""
    @State private var plate=""
    @State private var eta=15
    var body: some View {
        Form {
            Section("Your car") {
                TextField("Vehicle",text:$description);TextField("Color",text:$color);TextField("License plate",text:$plate).textInputAutocapitalization(.characters)
                Stepper("ETA: \(eta) minutes",value:$eta,in:0...1440,step:5)
                ActionButton(title:"Save vehicle details") {_ = try await app.call("saveVehicleDetails",["assignmentId":assignment["id"],"vehicleDesc":.string(description),"vehicleColor":.string(color),"vehiclePlate":.string(plate),"etaMinutes":.number(Double(eta))])}
                Text("These ride details are visible to authorized guardians of passengers.").font(.footnote)
            }
            Section {ConfirmAction(title:"Mark ride as leaving",detail:"Passengers and their guardians will receive the departure update.") {_ = try await app.call("markRideLeaving",["assignmentId":assignment["id"]])}}
        }.synclyList().navigationTitle("Ride safety").onAppear {description=assignment["vehicle_desc"].text;color=assignment["vehicle_color"].text;plate=assignment["vehicle_plate"].text;eta=Int(assignment["eta_minutes"].number ?? 15)}
    }
}
