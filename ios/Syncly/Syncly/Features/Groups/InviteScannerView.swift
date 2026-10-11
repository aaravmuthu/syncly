import SwiftUI
import VisionKit
import SafariServices

/// SwiftUI has no barcode-scanning view; this wraps Apple's native scanner.
struct InviteScannerView: UIViewControllerRepresentable {
    let onCode: (String)->Void
    let onFailure: (String)->Void
    func makeCoordinator()->Coordinator {Coordinator(onCode:onCode,onFailure:onFailure)}
    func makeUIViewController(context:Context)->DataScannerViewController {
        let scanner=DataScannerViewController(recognizedDataTypes:[.barcode(symbologies:[.qr])],qualityLevel:.balanced,recognizesMultipleItems:false,isHighFrameRateTrackingEnabled:false,isGuidanceEnabled:true,isHighlightingEnabled:true)
        scanner.delegate=context.coordinator
        do {try scanner.startScanning()} catch {context.coordinator.onFailure("Camera scanning is unavailable. Enter the invite code instead.")}
        return scanner
    }
    func updateUIViewController(_ scanner:DataScannerViewController,context:Context) {}
    static func dismantleUIViewController(_ scanner:DataScannerViewController,coordinator:Coordinator) {scanner.stopScanning()}
    final class Coordinator: NSObject,DataScannerViewControllerDelegate {
        let onCode:(String)->Void
        var accepted=false
        let onFailure:(String)->Void
        init(onCode:@escaping (String)->Void,onFailure:@escaping (String)->Void) {self.onCode=onCode;self.onFailure=onFailure}
        func dataScanner(_ scanner:DataScannerViewController,becameUnavailableWithError error:DataScannerViewController.ScanningUnavailable) {onFailure("Camera scanning is unavailable. Enter the invite code instead.")}
        func dataScanner(_ scanner:DataScannerViewController,didAdd addedItems:[RecognizedItem],allItems:[RecognizedItem]) {for item in addedItems {accept(item)}}
        func dataScanner(_ scanner:DataScannerViewController,didTapOn item:RecognizedItem) {accept(item)}
        private func accept(_ item:RecognizedItem) {
            guard !accepted,case .barcode(let barcode)=item,let raw=barcode.payloadStringValue else {return}
            let code:String
            if let url=URL(string:raw),url.scheme == "https",url.host == "syncly.website",url.pathComponents.count == 3,url.pathComponents[1] == "join" {code=url.pathComponents[2]}
            else {code=raw}
            let normalized=PlanningHelpers.inviteCode(code)
            guard (4...12).contains(code.count),normalized == code.uppercased() else {return}
            accepted=true;onCode(normalized)
        }
    }
}
struct ApprovalLinkView: View {
    let url: URL
    var body: some View {SafariPage(url:url).ignoresSafeArea()}
}
/// The existing token-scoped parent page is preserved until native capability APIs ship.
struct SafariPage: UIViewControllerRepresentable {
    let url:URL
    func makeUIViewController(context:Context)->SFSafariViewController {SFSafariViewController(url:url)}
    func updateUIViewController(_ controller:SFSafariViewController,context:Context) {}
}
