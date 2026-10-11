import SwiftUI
import MapKit
import CoreLocation
import Observation

@Observable
final class LocationSession: NSObject, @preconcurrency CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    var active = false
    var status = "Location is not being shared"
    var error: String?
    private var lastSent = Date.distantPast
    private var update: Task<Void,Never>?
    private var app: AppContainer?
    private var revision = 0
    private var stopTask:Task<Void,Never>?
    override init() { super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyHundredMeters; manager.distanceFilter = 25 }
    func start(_ app: AppContainer) async throws {
        await stopTask?.value
        guard !app.isDemo else { throw ServiceFailure(message:"The offline demo never requests or shares your location.") }
        guard manager.authorizationStatus != .denied && manager.authorizationStatus != .restricted else { throw ServiceFailure(message:"Location access is off. Enable When In Use access for Syncly in Settings to share.") }
        self.app = app
        if manager.authorizationStatus == .notDetermined { status = "Choose location access, then tap Start sharing again"; manager.requestWhenInUseAuthorization(); return }
        _ = try await app.call("setLocationSharing",["enabled":.bool(true)])
        revision += 1; active = true; error = nil; status = "Sharing while Radar is open"; manager.startUpdatingLocation()
    }
    func stop() {
        let wasActive=active
        revision += 1; active = false; manager.stopUpdatingLocation(); update?.cancel(); update = nil; status = "Location updates stopped"
        guard wasActive,let app else {return}
        stopTask=Task {
            do {_ = try await app.call("setLocationSharing",["enabled":.bool(false)]);status="Location sharing is off"}
            catch {self.error="Updates stopped on this device. Could not confirm sharing is off online; reconnect and tap Stop sharing."}
        }
    }
    func confirmStopped(_ app:AppContainer) async throws {
        stop();await stopTask?.value
        _ = try await app.call("setLocationSharing",["enabled":.bool(false)])
        error=nil;status="Location sharing is off"
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { stop(); error = "Location access is unavailable." }
    }
    func locationManager(_ manager: CLLocationManager,didUpdateLocations locations: [CLLocation]) {
        guard active,let location = locations.last,location.horizontalAccuracy >= 0,abs(location.timestamp.timeIntervalSinceNow) < 60,Date().timeIntervalSince(lastSent) >= 15,let app else { return }
        lastSent = .now; let current = revision
        update?.cancel()
        update = Task {
            do {
                let result = try await app.call("pushLocation",["lat":.number(location.coordinate.latitude),"lon":.number(location.coordinate.longitude),"accuracyM":.number(location.horizontalAccuracy)])
                guard current == revision,active,!Task.isCancelled else { return }
                guard result["ok"].flag else { stop(); error = "Location sharing is off on your account."; return }
            } catch { if current == revision,!Task.isCancelled { stop(); self.error = "Location sharing paused because the connection failed." } }
        }
    }
    func locationManager(_ manager: CLLocationManager,didFailWithError error: any Error) { self.error = "Could not read your location."; stop() }
}
struct RadarView: View {
    @Environment(AppContainer.self) private var app
    @Environment(\.scenePhase) private var scenePhase
    @State private var model = ResourceModel()
    @State private var pins = ResourceModel()
    @State private var location = LocationSession()
    var body: some View {
        List {
            DemoNotice()
            Section {
                if app.isDemo {ContentUnavailableView("No live locations in demo",systemImage:"location.slash",description:Text("Connect your account to view people who choose to share with you.")).frame(height:210)}
                else {Map { ForEach(pins.value.items.map(WireRow.init)) { r in if let lat = r["lat"].number,let lon = r["lon"].number { Marker(r["name"].text,coordinate:.init(latitude:lat,longitude:lon)) } } }.frame(height:230)}
                Text("Only people who share with you appear on the map. A missing pin does not mean they are at home.").font(.footnote).foregroundStyle(Theme.secondaryText)
            }
            Section("Your location") {
                Label(location.status,systemImage:location.active ? "location.fill" : "location.slash")
                if location.active || location.error != nil { ActionButton(title:"Stop sharing") { try await location.confirmStopped(app);await reload() } }
                else { ActionButton(title:"Start sharing",workingTitle:"Starting…") { try await location.start(app); await reload() } }
                Text("When In Use access only. This version sends updates while Radar is open and active; leaving Radar stops updates.").font(.footnote)
                InlineFailure(message:location.error)
                NavigationLink("Choose who sees your pin",destination:SharingView())
            }
            Section("Family safety") {
                ActionButton(title:"I arrived safely") { _ = try await app.call("arrivedSafely"); await reload() }
                NavigationLink("Running late",destination:DelayView())
                NavigationLink("Guardian check-in requests",destination:CheckinsView())
                HoldToConfirm(title:"Hold to alert my guardians") { _ = try await app.call("raiseSos",["lat":.null,"lon":.null,"note":.string("Need help")]) }
                Text("SOS alerts linked guardians. It does not contact emergency services. If you are in immediate danger, contact local emergency services.").font(.footnote)
            }
            InlineFailure(message:model.error); InlineFailure(message:pins.error)
        }.synclyList().navigationTitle("Radar").task { await reload() }.refreshable { await reload() }
        .onDisappear { location.stop() }
        .onChange(of:scenePhase) { _,phase in if phase != .active { location.stop() } }
    }
    private func reload() async { await model.load(app,"getMyRadar"); await pins.load(app,"getFriendPins") }
}
struct SharingView: View {
    @Environment(AppContainer.self) private var app
    @State private var peers = ResourceModel()
    @State private var state = ResourceModel()
    @State private var mode = "hour"
    var body: some View { Form {
        Section("Who can see you") {
            Picker("Duration",selection:$mode) { Text("One hour").tag("hour"); Text("Until end of day").tag("end_of_day"); Text("Until I stop").tag("indefinite") }
            ForEach(peers.value.items.map(WireRow.init)) { p in
                VStack(alignment:.leading) { Text(p["name"].text); ActionButton(title:"Share with this person") { _ = try await app.call("shareLocationWith",["viewerProfileId":p["profileId"],"mode":.string(mode)]); await reload() }; ActionButton(title:"Stop sharing with this person") { _ = try await app.call("stopSharingWith",["viewerProfileId":p["profileId"]]); await reload() } }
            }
        }
        Section("Ghost mode") {
            Text("Pause visibility to friends. Linked guardians retain their safety radar under the same rules as the web app.").font(.footnote)
            ForEach([("hour","Pause for one hour"),("tomorrow","Pause until tomorrow"),("until_reenabled","Pause until I resume"),("resume","Resume friend visibility")],id:\.0) { choice,label in ActionButton(title:label) { _ = try await app.call("setGhostMode",["choice":.string(choice)]); await reload() } }
        }
        InlineFailure(message:peers.error); InlineFailure(message:state.error)
    }.synclyList().navigationTitle("Location sharing").task { await reload() } }
    private func reload() async { await peers.load(app,"getSharePeers"); await state.load(app,"getSharingState") }
}
struct DelayView: View {
    @Environment(AppContainer.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var minutes = 15
    var body: some View { Form { Section { TextField("What happened?",text:$reason,axis:.vertical); Stepper("About \(minutes) minutes late",value:$minutes,in:1...1440,step:5); ActionButton(title:"Update my guardians") { _ = try await app.call("sendDelay",["reason":.string(reason),"minutes":.number(Double(minutes))]); dismiss() } } }.synclyList().navigationTitle("Running late") }
}
