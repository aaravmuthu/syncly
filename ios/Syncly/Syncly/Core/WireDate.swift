import Foundation

nonisolated enum WireDate {
    static func parse(_ value:String)->Date? {
        guard !value.isEmpty else {return nil}
        let formatter=ISO8601DateFormatter()
        if let date=formatter.date(from:value) {return date}
        formatter.formatOptions.insert(.withFractionalSeconds)
        return formatter.date(from:value)
    }
}
