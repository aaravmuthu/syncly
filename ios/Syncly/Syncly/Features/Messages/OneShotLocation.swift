import CoreLocation
import Foundation

nonisolated struct SharedCoordinate:Sendable {let lat:Double;let lon:Double}
final class OneShotLocation:NSObject,@preconcurrency CLLocationManagerDelegate {
    private let manager=CLLocationManager()
    private var pending:CheckedContinuation<SharedCoordinate,any Error>?
    private var timeout:Task<Void,Never>?
    override init() {super.init();manager.delegate=self;manager.desiredAccuracy=kCLLocationAccuracyHundredMeters}
    func request() async throws -> SharedCoordinate {
        guard pending == nil else {throw ServiceFailure(message:"A location request is already running.")}
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation {continuation in
                pending=continuation
                guard !Task.isCancelled else {cancel();return}
                switch manager.authorizationStatus {
                case .denied,.restricted:finish(.failure(ServiceFailure(message:"Allow When In Use location access in Settings to share your position.")))
                case .notDetermined:manager.requestWhenInUseAuthorization()
                default:manager.requestLocation()
                }
                if pending != nil {timeout=Task {try? await Task.sleep(for:.seconds(15));guard !Task.isCancelled else {return};finish(.failure(ServiceFailure(message:"Could not read a recent location. Try again outside.")))}}
            }
        } onCancel: {Task {@MainActor in self.cancel()}}
    }
    func cancel() {finish(.failure(CancellationError()))}
    private func finish(_ result:Result<SharedCoordinate,any Error>) {timeout?.cancel();timeout=nil;manager.stopUpdatingLocation();let continuation=pending;pending=nil;continuation?.resume(with:result)}
    func locationManagerDidChangeAuthorization(_ manager:CLLocationManager) {
        guard pending != nil else {return}
        switch manager.authorizationStatus {case .authorizedAlways,.authorizedWhenInUse:manager.requestLocation();case .denied,.restricted:finish(.failure(ServiceFailure(message:"Location access was not granted.")));default:break}
    }
    func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]) {
        guard let latest=locations.last,latest.horizontalAccuracy >= 0,abs(latest.timestamp.timeIntervalSinceNow) < 60 else {finish(.failure(ServiceFailure(message:"No recent location is available.")));return}
        finish(.success(.init(lat:latest.coordinate.latitude,lon:latest.coordinate.longitude)))
    }
    func locationManager(_ manager:CLLocationManager,didFailWithError error:any Error) {finish(.failure(ServiceFailure(message:"Could not read your location.")))}
}
