import SwiftUI
import MapKit

struct HomeLocationSettingsView:View {
    @Environment(AppContainer.self) private var app
    @State private var address=""
    @State private var zip=""
    @State private var center:CLLocationCoordinate2D?
    @State private var chosen:CLLocationCoordinate2D?
    @State private var position:MapCameraPosition = .automatic
    var body:some View {
        Form {
            Section("Your private planning base") {
                TextField("Home address (optional)",text:$address)
                TextField("ZIP code",text:$zip).keyboardType(.numberPad)
                Map(position:$position) {if let chosen {Marker("Your planning base",coordinate:chosen)}}.frame(height:240).overlay {Image(systemName:"plus").font(.title).accessibilityHidden(true)}.onMapCameraChange {center=$0.region.center}
                Button("Use map center") {chosen=center}
                Text("Choose a place explicitly. Ordinary group members do not receive these home coordinates; approved guardians can see your family details under Syncly’s rules.").font(.footnote)
                if chosen != nil {Label("Map position selected",systemImage:"checkmark.circle")}
            }
            Section {
                ActionButton(title:"Save home area") {var patch:[String:JSONValue]=["home_address":.string(address),"zip_code":.string(zip)];if let chosen {patch["home_lat"] = .number(chosen.latitude);patch["home_lon"] = .number(chosen.longitude)};_ = try await app.call("saveProfile",patch);try await app.loadProfile()}
                ConfirmAction(title:"Clear saved home location",detail:"Your exact saved home coordinates and address will be removed.") {_ = try await app.call("saveProfile",["home_address":.null,"home_lat":.null,"home_lon":.null]);chosen=nil;address="";try await app.loadProfile()}
            }
        }.synclyList().navigationTitle("Home area").onAppear {address=app.profile["home_address"].text;zip=app.profile["zip_code"].text;if let lat=app.profile["home_lat"].number,let lon=app.profile["home_lon"].number {chosen = .init(latitude:lat,longitude:lon);position = .region(.init(center:.init(latitude:lat,longitude:lon),span:.init(latitudeDelta:0.04,longitudeDelta:0.04)))}}
    }
}
