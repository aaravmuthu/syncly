import SwiftUI
import AVKit

struct ChatMessageRow:View {
    let message:JSONValue
    let direct:Bool
    let mine:Bool
    let peerName:String
    var peerReadAt:String = ""
    let reactions:[JSONValue]
    let onReply:()->Void
    let onReaction:(String) async throws -> Void
    @State private var error:String?
    private var sender:String {mine ? "You" : direct ? peerName : message["profiles"]["display_name"].text.isEmpty ? "Group update" : message["profiles"]["display_name"].text}
    var body:some View {
        HStack(alignment:.bottom) {
            if mine {Spacer(minLength:40)}
            VStack(alignment:mine ? .trailing : .leading,spacing:5) {
                if !direct {Text(sender).font(.caption).foregroundStyle(.secondary)}
                VStack(alignment:.leading,spacing:8) {
                    if !message["reply_to"]["content"].text.isEmpty {Text("Replying to: " + message["reply_to"]["content"].text).font(.caption).foregroundStyle(.secondary)}
                    if direct {DirectMessageLocation(message:message)}
                    if !message["content"].text.isEmpty {Text(message["content"].text).textSelection(.enabled)}
                    if let url=secureURL(message["media_url"].text) {
                        if direct {VoiceNotePlayer(url:url)}
                        else {AsyncImage(url:url) {image in image.resizable().scaledToFit()} placeholder:{ProgressView()}.frame(maxHeight:240).accessibilityLabel("Shared photo")}
                    }
                }.padding(12).background(mine ? Theme.primary.opacity(0.12) : Color.secondary.opacity(0.08),in:RoundedRectangle(cornerRadius:18))
                if !reactions.isEmpty {Text(reactions.map {$0["emoji"].text}.joined(separator:" ")).font(.caption).accessibilityLabel("Reactions: " + reactions.map {$0["emoji"].text}.joined(separator:" "))}
                if let date=WireDate.parse(message["created_at"].text) {Text(date,format:.dateTime.hour().minute()).font(.caption2).foregroundStyle(.secondary)}
                if direct,mine,let read=WireDate.parse(peerReadAt),let sent=WireDate.parse(message["created_at"].text),read >= sent {
                    Label("Read",systemImage:"checkmark.circle").font(.caption2).foregroundStyle(.secondary)
                }
                InlineFailure(message:error)
            }
            if !mine {Spacer(minLength:40)}
        }.padding(.vertical,4).contextMenu {
            if direct {ForEach(["❤️","👍","😂"],id:\.self) {emoji in Button("React " + emoji) {Task {do {try await onReaction(emoji);error=nil} catch {self.error=error.localizedDescription}}}}}
            else {Button("Reply",systemImage:"arrowshape.turn.up.left") {onReply()}}
        }
    }
    private func secureURL(_ text:String)->URL? {guard let url=URL(string:text),url.scheme == "https",url.user == nil,url.password == nil else {return nil};return url}
}
struct VoiceNotePlayer:View {
    let url:URL
    @State private var player:AVPlayer?
    @Environment(\.scenePhase) private var phase
    var body:some View {
        VideoPlayer(player:player).frame(height:80).accessibilityLabel("Voice note playback")
            .task(id:url) {player?.pause();player=AVPlayer(url:url)}
            .onDisappear {player?.pause();player=nil}
            .onChange(of:phase) {_,phase in if phase != .active {player?.pause()}}
    }
}
