import SwiftUI
import Supabase
import PhotosUI
import AVKit
import MapKit
import UniformTypeIdentifiers

struct InboxView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    var body: some View {
        List {
            DemoNotice()
            Section("Squads") { ForEach(model.value["squads"].items.map(WireRow.init)) { r in NavigationLink { ChatView(id:r.id,title:r["name"].text,direct:false) } label: { HStack { Text(r["emoji"].text); Text(r["name"].text); Spacer(); if let n = r["unread"].number,n > 0 { Text("\(Int(n)) unread").font(.caption) } } } } }
            Section("Direct messages") { ForEach(model.value["threads"].items.map(WireRow.init)) { r in NavigationLink { ChatView(id:r.id,title:r["peer"]["display_name"].text,direct:true) } label: { HStack { Text(r["peer"]["avatar_emoji"].text); VStack(alignment:.leading) { Text(app.displayName(r["peer"]["id"].text,fallback:r["peer"]["display_name"].text)); Text(r["last"]["content"].text).font(.subheadline).foregroundStyle(Theme.secondaryText) }; Spacer(); if let n = r["unread"].number,n > 0 { Text("\(Int(n)) unread").font(.caption) } } } } }
            InlineFailure(message:model.error)
            if model.loading { ProgressView() }
        }.synclyList().navigationTitle("Messages").toolbar {ToolbarItem(placement:.topBarTrailing) {NavigationLink("New message",destination:ContactsView())}}.task { await model.load(app,"listInbox") }.refreshable { await model.load(app,"listInbox") }
    }
}
struct ChatView: View {
    let id: String
    let title: String
    let direct: Bool
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var draft = ""
    @State private var selectedImage: PhotosPickerItem?
    @State private var mediaURL: String?
    @State private var attachmentError: String?
    @State private var importVoice = false
    @State private var recorder=VoiceRecorder()
    @State private var reply:JSONValue = .null
    @State private var coordinate=OneShotLocation()
    @Environment(\.scenePhase) private var scenePhase
    private var operation: String { direct ? "getThread" : "listMessages" }
    private var input: [String:JSONValue] { [direct ? "threadId" : "groupId":.string(id)] }
    var body: some View {
        List {
            DemoNotice()
            if direct,let lat=model.value["telemetry"]["lat"].number,let lon=model.value["telemetry"]["lon"].number,lat.isFinite,lon.isFinite,(-90...90).contains(lat),(-180...180).contains(lon) {
                Section("Shared by " + title) {
                    Map {Marker(title,coordinate:.init(latitude:lat,longitude:lon))}.frame(height:160)
                    Text(model.value["telemetry"]["status"].text.isEmpty ? "Sharing location" : model.value["telemetry"]["status"].text)
                    if let battery=model.value["telemetry"]["battery"].number {Label("Battery \(Int(min(100,max(0,battery))))%",systemImage:"battery.100").font(.caption)}
                    if let date=WireDate.parse(model.value["telemetry"]["at"].text) {HStack {Text("Last update");Text(date,style:.relative)}.font(.caption)}
                    Text("This is their latest shared update; it may be out of date.").font(.caption).foregroundStyle(Theme.secondaryText)
                }
            }
            ForEach(model.value["messages"].items.map(WireRow.init)) {row in
                ChatMessageRow(message:row.value,direct:direct,mine:row["sender_id"].text == model.value["me"].text,peerName:title,peerReadAt:model.value["peerReadAt"].text,reactions:model.value["reactions"].items.filter {$0["message_id"] == row["id"]},onReply:{reply=row.value},onReaction:{emoji in
                    _ = try await app.call("toggleReaction",["messageId":row["id"],"emoji":.string(emoji)]);await reload()
                }).listRowBackground(Color.clear).listRowSeparator(.hidden)
            }
            if model.value["messages"].items.isEmpty,!model.loading { ContentUnavailableView("Start the conversation",systemImage:"bubble.left.and.bubble.right") }
            InlineFailure(message:model.error)
        }.listStyle(.plain).scrollContentBackground(.hidden).background(Theme.background).navigationTitle(title).navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge:.bottom) {
            VStack(alignment:.leading,spacing:8) {
                if mediaURL != nil { HStack { Label("Attachment ready",systemImage:"paperclip"); Spacer(); Button("Remove") { mediaURL = nil } }.font(.caption) }
                if reply != .null {HStack {Text("Replying to: " + reply["content"].text).font(.caption).lineLimit(1);Button("Cancel reply") {reply = .null}}}
                if direct {
                    ActionButton(title:"Share my current location",workingTitle:"Finding your location…") {
                        guard !app.isDemo else {throw ServiceFailure(message:"Demo mode never requests or sends your location.")}
                        let position=try await coordinate.request()
                        _ = try await app.call("sendDirect",["threadId":.string(id),"kind":.string("location"),"content":.string("Shared my current location"),"meta":.object(["lat":.number(position.lat),"lon":.number(position.lon),"label":.string("My location")])]);await reload()
                    }
                    HStack {
                        ActionButton(title:recorder.recording ? "Stop recording" : "Record voice") {guard !app.isDemo else {throw ServiceFailure(message:"Voice recording requires a live connection.")};if recorder.recording {recorder.stop()} else {try await recorder.start()}}
                        if recorder.ready {ActionButton(title:"Attach recording") {let dataURL=try SafeUpload.audio(recorder.data());let uploaded=try await app.call("uploadVoiceNote",["dataUrl":.string(dataURL)]);mediaURL=uploaded["url"].text;recorder.cancel()};Button("Discard") {recorder.cancel()}}
                    }
                }
                InlineFailure(message:attachmentError)
                HStack(alignment:.bottom) {
                    if !direct { PhotosPicker(selection:$selectedImage,matching:.images) { Image(systemName:"photo.badge.plus").frame(minWidth:44,minHeight:44) }.accessibilityLabel("Attach photo") }
                    else { Button("Attach voice note",systemImage:"waveform") { importVoice = true }.labelStyle(.iconOnly).frame(minWidth:44,minHeight:44) }
                    TextField("Message",text:$draft,axis:.vertical).lineLimit(1...5).textFieldStyle(.roundedBorder)
                    ActionButton(title:"Send",workingTitle:"Sending…") {
                        var body = input
                        body["content"] = .string(draft);if !direct {body["replyToId"] = reply["id"]}; if let mediaURL { body["mediaUrl"] = .string(mediaURL); if direct { body["kind"] = .string("voice") } }
                        _ = try await app.call(direct ? "sendDirect" : "sendMessage",body)
                        draft = ""; mediaURL = nil; reply = .null; await reload()
                    }
                }
            }.padding().background(.bar)
        }
        .onDisappear {recorder.cancel();coordinate.cancel()}
        .onChange(of:scenePhase) {_,phase in if phase != .active {recorder.stop();coordinate.cancel()}}
        .refreshable { await reload() }
        .task {
            await reload()
            guard !app.isDemo,let client = app.client else { return }
            let channel = client.channel("native-chat-\(UUID().uuidString)")
            let stream = channel.postgresChange(AnyAction.self,schema:"public",table:direct ? "direct_messages" : "group_messages",filter:.eq(direct ? "thread_id" : "group_id",value:id))
            await withTaskCancellationHandler {
                do { try await channel.subscribeWithError(); for await _ in stream { if Task.isCancelled { break }; await reload() } }
                catch { if !Task.isCancelled { model.error = "Live updates disconnected. Pull to refresh." } }
                await client.removeChannel(channel)
            } onCancel: { Task { await client.removeChannel(channel) } }
        }
        .task(id:selectedImage) {
            guard let selectedImage else { return }; attachmentError = nil
            do {
                guard let data = try await selectedImage.loadTransferable(type:Data.self) else { throw ServiceFailure(message:"Could not read this photo.") }
                let (dataURL,ext) = try SafeUpload.image(data)
                let result = try await app.call("uploadChatImage",["dataUrl":.string(dataURL),"ext":.string(ext)])
                guard let _ = secureURL(result["url"].text) else { throw ServiceFailure(message:"Could not prepare the attachment.") }; mediaURL = result["url"].text
            } catch { attachmentError = error.localizedDescription }
        }
        .fileImporter(isPresented:$importVoice,allowedContentTypes:[.audio]) { result in
            Task { do { let url = try result.get(); let access = url.startAccessingSecurityScopedResource(); defer {if access {url.stopAccessingSecurityScopedResource()}}; guard (try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? Int.max) <= 8*1024*1024 else {throw ServiceFailure(message:"Voice note must be under 8 MB.")};let bytes = try Data(contentsOf:url); let dataURL = try SafeUpload.audio(bytes); let uploaded = try await app.call("uploadVoiceNote",["dataUrl":.string(dataURL)]); mediaURL = uploaded["url"].text } catch {attachmentError = error.localizedDescription} }
        }
    }
    private func reload() async {
        await model.load(app,operation,input)
        guard model.error == nil else { return }
        do {
            if direct { _ = try await app.call("markThreadRead",["threadId":.string(id)]) }
            else { _ = try await app.call("markRead",["messageIds":.array(model.value["messages"].items.map {$0["id"]})]) }
        } catch { model.error = "Messages loaded, but read status could not be saved." }
    }
    private func secureURL(_ text: String) -> URL? { guard let url = URL(string:text),url.scheme == "https",url.user == nil,url.password == nil else {return nil}; return url }
}
