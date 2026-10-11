import SwiftUI

struct GroupAppearanceTheme:Identifiable {
    let id:String
    let label:String
    let color:Color
    static let all:[Self]=[
        .init(id:"obsidian_emerald",label:"Obsidian Emerald",color:.init(red:0.04,green:0.23,blue:0.17)),
        .init(id:"neon_cyber",label:"Neon Cyber",color:.init(red:0.05,green:0.16,blue:0.39)),
        .init(id:"midnight_purple",label:"Midnight Purple",color:.init(red:0.23,green:0.08,blue:0.44)),
        .init(id:"sunset_glow",label:"Sunset Glow",color:.init(red:0.49,green:0.18,blue:0.07)),
        .init(id:"rose_dusk",label:"Rose Dusk",color:.init(red:0.44,green:0.10,blue:0.27)),
        .init(id:"arctic_steel",label:"Arctic Steel",color:.init(red:0.12,green:0.23,blue:0.30))]
    static func resolve(_ id:String)->Self {all.first {$0.id == id} ?? all[0]}
}
struct MemberAvatarView:View {
    let url:String
    let emoji:String
    var size:CGFloat=44
    var body:some View {
        Group {if let url=URL(string:url),url.scheme == "https" {AsyncImage(url:url) {image in image.resizable().scaledToFill()} placeholder:{Text(emoji.isEmpty ? "🙂" : emoji).font(.title)}} else {Text(emoji.isEmpty ? "🙂" : emoji).font(.title)}}
            .frame(width:size,height:size).clipShape(Circle()).accessibilityHidden(true)
    }
}
