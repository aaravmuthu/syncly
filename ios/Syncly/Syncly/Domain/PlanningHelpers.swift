import Foundation

nonisolated struct CostEstimate: Sendable {
    let perPersonMin: Int, perPersonMax: Int, groupMin: Int, groupMax: Int
    let travel: Double
    let lines: [(String, String)]
    static func estimate(option: PlanOption, category: String, headcount: Int, carCount: Int? = nil) -> Self {
        let heads = max(1,headcount), cars = max(1,carCount ?? Int(ceil(Double(heads)/4)))
        let miles = option.distanceMiles ?? option.travelMinutes / 60 * 28
        let food = ["dinner","party","hangout"].contains(category)
        let entryMin = food ? 0 : option.costMin.rounded(), entryMax = food ? 0 : option.costMax.rounded()
        let foodMin = (option.costMin * (food ? 1 : 0.35)).rounded(), foodMax = (option.costMax * (food ? 1 : 0.5)).rounded()
        let travel = option.requiresDriving ? (miles * 2 * 0.18 * Double(cars) / Double(heads) * 100).rounded()/100 : 0
        let low = Int((entryMin+foodMin+travel).rounded()), high = Int((entryMax+foodMax+travel).rounded())
        var lines: [(String,String)] = []
        if entryMax > 0 { lines.append(("Entry / tickets", moneyRange(entryMin,entryMax))) }
        lines.append((food ? "Food & drinks" : "Snacks & extras", moneyRange(foodMin,foodMax)))
        if option.requiresDriving { lines.append(("Travel (\(cars) \(cars == 1 ? "car" : "cars"), split)",moneyRange(travel,travel))) }
        return Self(perPersonMin:low,perPersonMax:high,groupMin:low*heads,groupMax:high*heads,travel:travel,lines:lines)
    }
    static func moneyRange(_ a: Double, _ b: Double) -> String {
        func money(_ value:Double)->String {"$" + String(format:value.truncatingRemainder(dividingBy:1) == 0 ? "%.0f" : "%.2f",locale:Locale(identifier:"en_US_POSIX"),value)}
        return a == b ? money(a) : money(a)+"–"+money(b)
    }
}
nonisolated enum PlanningHelpers {
    static let slots = (11...22).map { String(format:"%02d:00",$0) }
    static func bestWindow(_ cells: [(String,Int,Int)]) -> (String,String,Int,Int)? {
        guard let peak = cells.map({$0.1}).max(), peak > 0 else { return nil }
        var start: Int?, bestStart = 0, bestLength = 0
        for (i,c) in cells.enumerated() {
            if c.1 == peak {
                if start == nil { start = i }
                let length = i - (start ?? i) + 1
                if length > bestLength { bestStart = start ?? i; bestLength = length }
            } else { start = nil }
        }
        return (cells[bestStart].0,cells[bestStart+bestLength-1].0,peak,cells[bestStart].2)
    }
    static func isOver(start: Date?, end: Date?, now: Date) -> Bool { (end ?? start).map { $0.addingTimeInterval(14400) < now } ?? false }
    static func inviteCode(_ raw: String) -> String { String(raw.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }.prefix(12)) }
    static func canEdit(_ status: String) -> Bool { ["collecting","recommending","voting"].contains(status) }
}
