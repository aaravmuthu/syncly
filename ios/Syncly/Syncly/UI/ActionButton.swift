import SwiftUI

struct InlineFailure: View {
    let message: String?
    var body: some View {
        if let message,!message.isEmpty {
            Label(message,systemImage:"exclamationmark.circle")
                .font(.subheadline).foregroundStyle(Theme.foreground).fixedSize(horizontal:false,vertical:true)
                .accessibilityLabel("Error: \(message)")
        }
    }
}
struct ActionButton: View {
    let title: String
    var workingTitle = "Working…"
    var role: ButtonRole?
    let action: () async throws -> Void
    @State private var busy = false
    @State private var error: String?
    @State private var completed = 0
    @State private var operationTask: Task<Void,Never>?
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            Button(role:role) {
                busy = true; error = nil
                operationTask = Task {
                    defer { busy = false }
                    do { try await action(); if !Task.isCancelled { completed += 1 } }
                    catch is CancellationError { }
                    catch { self.error = error.localizedDescription }
                }
            } label: {
                HStack { if busy { ProgressView() }; Text(busy ? workingTitle : title) }.frame(minHeight:28)
            }.disabled(busy)
            InlineFailure(message:error)
        }
        .sensoryFeedback(.success,trigger:completed)
        .onDisappear { operationTask?.cancel() }
    }
}
struct ConfirmAction: View {
    let title: String
    let detail: String
    var role:ButtonRole? = .destructive
    let action: () async throws -> Void
    @State private var confirm = false
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        VStack(alignment:.leading) {
            Button(title,role:role) { confirm = true }.disabled(busy)
            InlineFailure(message:error)
        }.confirmationDialog(title,isPresented:$confirm,titleVisibility:.visible) {
            Button(title,role:role) {
                busy = true; error = nil
                Task { defer { busy = false }; do { try await action() } catch { self.error = error.localizedDescription } }
            }.accessibilityIdentifier("confirm-" + title)
            Button("Cancel",role:.cancel) { }
        } message: { Text(detail) }
    }
}
struct HoldToConfirm: View {
    let title: String
    let action: () async throws -> Void
    @State private var holding = false
    @State private var confirmed = false
    @State private var error: String?
    @State private var fallback = false
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            Button { if voiceOver { fallback = true } } label: {
                Label(holding ? "Keep holding…" : title,systemImage:"hand.raised.fill").frame(minHeight:44)
            }
            .onLongPressGesture(minimumDuration:1.5,maximumDistance:20,pressing:{ holding = $0 },perform:{ confirmed = true })
            .accessibilityHint("Hold for one and a half seconds to confirm. VoiceOver opens a confirmation dialog.")
            .accessibilityAction(named:"Confirm \(title)") { fallback = true }
            InlineFailure(message:error)
        }
        .confirmationDialog(title,isPresented:$fallback,titleVisibility:.visible) { Button("Confirm",role:.destructive) { confirmed = true }; Button("Cancel",role:.cancel) {} }
        .task(id:confirmed) {
            guard confirmed else { return }; defer { confirmed = false }
            do { try await action() } catch { self.error = error.localizedDescription }
        }
    }
}
extension View {
    func synclyList() -> some View { self.scrollContentBackground(.hidden).background(Theme.background).scrollDismissesKeyboard(.interactively) }
}
