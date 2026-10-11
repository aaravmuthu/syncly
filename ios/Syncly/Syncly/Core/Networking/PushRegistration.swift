import Foundation
import Observation
import UserNotifications
import UIKit

@Observable
final class PushRegistration {
    var status = "Push notifications are off"
    var error: String?
    @ObservationIgnored weak var app: AppContainer?
    private var deviceToken: String?
    func enable() async throws {
        guard let app,!app.isDemo,app.liveDataEnabled else {throw ServiceFailure(message:"Push registration needs the verified live connection and a physical device.")}
        let allowed=try await UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.badge,.sound])
        guard allowed else {throw ServiceFailure(message:"Notification access was not granted. You can still use in-app Activity.")}
        status="Registering this device…";UIApplication.shared.registerForRemoteNotifications()
    }
    func registered(_ token: Data) {
        deviceToken=token.map {String(format:"%02x",$0)}.joined()
        guard let app,let deviceToken else {return}
        Task {
            do {
                #if DEBUG
                let environment="sandbox"
                #else
                let environment="production"
                #endif
                try await app.registerPush(token:deviceToken,environment:environment)
                status="Device registered; delivery depends on the APNs backend"
            } catch {status="Apple registration received; backend registration failed";self.error="The native push backend is not available yet."}
        }
    }
    func failed() {status="Device registration failed";error="Push notifications require a signed physical-device build and APNs configuration."}
}
/// SwiftUI has no direct APNs registration callback API.
final class PushDelegate: NSObject,UIApplicationDelegate {
    var registration: PushRegistration?
    func application(_ application:UIApplication,didRegisterForRemoteNotificationsWithDeviceToken deviceToken:Data) {registration?.registered(deviceToken)}
    func application(_ application:UIApplication,didFailToRegisterForRemoteNotificationsWithError error:any Error) {registration?.failed()}
}
