import SwiftUI
import UniformTypeIdentifiers

struct CalendarDocument: FileDocument {
    static var readableContentTypes: [UTType] { [UTType(filenameExtension:"ics") ?? .plainText] }
    let text: String
    init(configuration: ReadConfiguration) throws { text = String(data:configuration.file.regularFileContents ?? Data(),encoding:.utf8) ?? "" }
    init(plan: JSONValue,rec: JSONValue) {
        text = CalendarExport.ics(title:plan["title"].text,description:"Planned with Syncly",location:rec["location_name"].text,date:plan["window_start"].text,start:rec["suggested_start"].text,end:rec["suggested_end"].text)
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents:Data(text.utf8)) }
}
nonisolated enum CalendarExport {
    static func fold(_ line: String) -> String {
        var output = "", bytes = 0
        for scalar in line.unicodeScalars {
            let part = String(scalar), count = part.utf8.count
            if bytes+count > 75 { output += "\r\n "; bytes = 1 }
            output += part; bytes += count
        }
        return output
    }
    static func escape(_ s: String) -> String { s.replacingOccurrences(of:"\\",with:"\\\\").replacingOccurrences(of:",",with:"\\,").replacingOccurrences(of:";",with:"\\;").replacingOccurrences(of:"\r\n",with:"\n").replacingOccurrences(of:"\r",with:"\n").replacingOccurrences(of:"\n",with:"\\n") }
    static func dates(date: String,start: String,end: String,timeZone: TimeZone = .current,now: Date = .now) -> (Date,Date) {
        var calendar = Calendar(identifier:.gregorian); calendar.timeZone = timeZone
        let formatter = DateFormatter(); formatter.locale = Locale(identifier:"en_US_POSIX"); formatter.timeZone = timeZone; formatter.dateFormat = "yyyy-MM-dd"
        let day = WireDate.parse(date) ?? formatter.date(from:date) ?? now.addingTimeInterval(86400)
        func make(_ value: String,fallback: Int) -> Date {
            let parts = value.split(separator:":"); let h = parts.first.flatMap {Int($0)} ?? fallback; let m = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
            return calendar.date(bySettingHour:(0..<24).contains(h) ? h : fallback,minute:(0..<60).contains(m) ? m : 0,second:0,of:day) ?? day
        }
        let first = make(start,fallback:19); var last = make(end,fallback:21)
        if last < first { last = calendar.date(byAdding:.day,value:1,to:last) ?? last.addingTimeInterval(86400) }
        if last == first { last = first.addingTimeInterval(7200) }
        return (first,last)
    }
    static func ics(title: String,description: String,location: String,date: String,start: String,end: String,timeZone: TimeZone = .current,now: Date = .now) -> String {
        let (start,end) = dates(date:date,start:start,end:end,timeZone:timeZone,now:now)
        let formatter = DateFormatter(); formatter.timeZone = TimeZone(secondsFromGMT:0); formatter.locale = Locale(identifier:"en_US_POSIX"); formatter.dateFormat = "yyyyMMdd'T'HHmm'00Z'"
        return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Syncly//Plan//EN","BEGIN:VEVENT","UID:\(UUID().uuidString)@syncly","DTSTAMP:\(formatter.string(from:now))","DTSTART:\(formatter.string(from:start))","DTEND:\(formatter.string(from:end))","SUMMARY:\(escape(title))","DESCRIPTION:\(escape(description))","LOCATION:\(escape(location))","END:VEVENT","END:VCALENDAR"].map(fold).joined(separator:"\r\n")+"\r\n"
    }
}
