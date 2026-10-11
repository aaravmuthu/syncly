import Foundation
import AVFoundation
import Observation

@Observable final class VoiceRecorder {
    private var recorder:AVAudioRecorder?
    private var file:URL?
    private var expiry:Task<Void,Never>?
    var recording=false
    var ready=false
    func start() async throws {
        guard await AVAudioApplication.requestRecordPermission() else {throw ServiceFailure(message:"Microphone access is off. Enable it in Settings to record a voice note.")}
        cancel()
        let session=AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord,mode:.default,options:[.defaultToSpeaker])
        try session.setActive(true)
        let url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("m4a")
        do {
            let recorder=try AVAudioRecorder(url:url,settings:[AVFormatIDKey:kAudioFormatMPEG4AAC,AVSampleRateKey:44100,AVNumberOfChannelsKey:1,AVEncoderBitRateKey:64000])
            guard recorder.record() else {throw ServiceFailure(message:"Could not start voice recording.")}
            self.recorder=recorder;file=url;recording=true;ready=false
            expiry=Task {try? await Task.sleep(for:.seconds(120));guard !Task.isCancelled else {return};stop()}
        } catch {try? session.setActive(false,options:.notifyOthersOnDeactivation);throw error}
    }
    func stop() {guard recording else {return};expiry?.cancel();expiry=nil;recorder?.stop();recording=false;ready=file != nil;try? AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation)}
    func data() throws -> Data {guard !recording,ready,let file else {throw ServiceFailure(message:"Stop recording before attaching the note.")};return try Data(contentsOf:file)}
    func cancel() {stop();recorder=nil;if let file {try? FileManager.default.removeItem(at:file)};file=nil;ready=false}
}
