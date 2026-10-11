import SwiftUI

struct WireDateText:View {
    let value:String
    var body:some View {
        if let date=WireDate.parse(value) {
            Text(date,format:.dateTime.year().month(.abbreviated).day().hour().minute())
        } else if !value.isEmpty {
            Text("Time unavailable")
        }
    }
}
