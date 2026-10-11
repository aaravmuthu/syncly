import Foundation

nonisolated struct PrivateConstraints: Codable, Sendable, Equatable {
    var maxSpend: Double?, maxTicketPrice: Double?, totalBudget: Double?
    var likedTags: [String]?, dislikedTags: [String]?, dietary: [String]?, allergies: [String]?, venueStyle: [String]?
    var maxTravelMinutes: Double?, maxDistanceMiles: Double?, zipCode: String?
    var needsRide: Bool?, canDrive: Bool?, seats: Double?
    var earliestStart: String?, latestEnd: String?, requiredReturnTime: String?
    var unavailableDates: [String]?, availability: [String]?
    var parentApprovalRequired: Bool?, parentConditions: [String]?
    var maxDays: Double?, travelMode: String?, destinationTypes: [String]?
    var notes: String?, skipped: Bool?
}
nonisolated struct DemoMember: Codable, Identifiable, Sendable {
    let id: String, name: String, emoji: String
    let sacrificeLoad: Double
    var constraints: PrivateConstraints
}
nonisolated struct PlanOption: Codable, Identifiable, Sendable, Equatable {
    let key: String, title: String, subtitle: String
    let category: [String]
    let costMin: Double, costMax: Double, travelMinutes: Double
    let start: String, end: String, location: String
    let tags: [String], dietaryFriendly: [String]
    let style: String
    let requiresDriving: Bool
    var distanceMiles: Double?
    var id: String { key }
}
nonisolated struct OptionScore: Sendable, Identifiable {
    let option: PlanOption
    let score: Int
    let feasible: Bool
    let hardFailures: Int, budgetFit: Int, scheduleFit: Int, travelFit: Int, dietaryFit: Int
    let preferenceFit: Int, transportFit: Int, fairness: Int, overallFit: Int
    let reasons: [String], cautions: [String]
    var id: String { option.key }
}
nonisolated enum PlanningEngine {
    static func minutes(_ value: String?) -> Double? {
        guard let value, !value.isEmpty else { return nil }
        let pieces = value.split(separator: ":", omittingEmptySubsequences: false)
        guard let first = pieces.first, let hour = Double(first) else { return nil }
        return hour * 60 + (pieces.count > 1 ? Double(pieces[1]) ?? 0 : 0)
    }
    static func homeBy(_ text: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?", options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text), var h = Double(text[range]) else { return nil }
        let m = Range(match.range(at: 2), in: text).flatMap { Double(text[$0]) } ?? 0
        let ap = Range(match.range(at: 3), in: text).map { text[$0].lowercased() }
        if ap == "pm" && h < 12 { h += 12 }
        if ap == "am" && h == 12 { h = 0 }
        if ap == nil && h <= 11 { h += 12 }
        return h * 60 + m
    }
    private static func clamp(_ v: Double) -> Double { max(0, min(1, v)) }
    private struct Evaluation { let kinds: Set<String>; let soft: Double }
    private static func evaluate(_ o: PlanOption, _ m: DemoMember) -> Evaluation {
        let c = m.constraints
        var hard: Set<String> = []
        var points = 0.0, maximum = 0.0
        let cap = c.maxSpend ?? c.totalBudget
        if let cap, o.costMin > cap { hard.insert("budget") }
        if let ticket = c.maxTicketPrice, o.style == "venue", o.costMin > ticket { hard.insert("budget") }
        let needs = ((c.dietary ?? []) + (c.allergies ?? [])).map { $0.lowercased().trimmingCharacters(in: .whitespaces) }
        if !needs.isEmpty, o.style != "venue", o.style != "outdoor", needs.contains(where: { !o.dietaryFriendly.contains($0) }) { hard.insert("dietary") }
        if let v = c.maxTravelMinutes, o.travelMinutes > v { hard.insert("travel") }
        if let v = c.maxDistanceMiles, let miles = o.distanceMiles, miles > v { hard.insert("travel") }
        let start = minutes(o.start) ?? 0, end = minutes(o.end) ?? 0
        if let v = minutes(c.earliestStart), start < v { hard.insert("schedule") }
        if let v = minutes(c.latestEnd), end > v { hard.insert("schedule") }
        if let v = minutes(c.requiredReturnTime), end + (o.travelMinutes / 2).rounded() > v { hard.insert("curfew") }
        if c.needsRide == true && o.requiresDriving && c.canDrive != true { maximum += 1 }
        for cond in c.parentConditions ?? [] { if let v = homeBy(cond), end + (o.travelMinutes / 2).rounded() > v { hard.insert("condition") } }
        let tags = o.tags.map { $0.lowercased() }
        let liked = (c.likedTags ?? []).map { $0.lowercased() }
        let disliked = (c.dislikedTags ?? []).map { $0.lowercased() }
        if !liked.isEmpty {
            maximum += 2
            let hits = liked.filter { tags.contains($0) || o.title.lowercased().contains($0) }.count
            points += 2 * clamp(Double(hits) / Double(min(2, liked.count)))
        }
        if !disliked.isEmpty { maximum += 1.5; points += disliked.contains(where: { tags.contains($0) }) ? 0 : 1.5 }
        if let styles = c.venueStyle, !styles.isEmpty { maximum += 1.5; points += styles.map { $0.lowercased() }.contains(o.style) ? 1.5 : 0.3 }
        if let cap { maximum += 2; points += 2 * clamp((cap - (o.costMin + o.costMax) / 2) / max(cap, 1) + 0.35) }
        if let v = c.maxTravelMinutes { maximum += 1.5; points += 1.5 * clamp(1 - o.travelMinutes / max(v, 1)) }
        if let types = c.destinationTypes, !types.isEmpty, o.style == "trip" { maximum += 2; points += types.contains(where: { tags.contains($0.lowercased()) }) ? 2 : 0.4 }
        if let days = c.maxDays, o.style == "trip" { maximum += 1; points += days >= 2 ? 1 : 0.3 }
        return Evaluation(kinds: hard, soft: maximum == 0 ? 0.72 : clamp(points / maximum))
    }
    static func score(_ option: PlanOption, members: [DemoMember]) -> OptionScore {
        let e = members.map { evaluate(option, $0) }
        let riders = members.filter { $0.constraints.needsRide == true }.count
        let seats = members.reduce(0.0) { result, m in
            let c = m.constraints
            guard c.canDrive == true, c.maxTravelMinutes == nil || option.travelMinutes <= (c.maxTravelMinutes ?? 0) else { return result }
            return result + max(0, c.seats ?? 3)
        }
        let transportOK = !option.requiresDriving || riders == 0 || seats >= Double(riders)
        let ratio = !option.requiresDriving || riders == 0 ? 1 : clamp(seats / Double(max(1, riders)))
        let blocked = e.filter { !$0.kinds.isEmpty }.count
        let feasible = blocked == 0 && transportOK
        let softs = e.map(\.soft)
        let avg = softs.isEmpty ? 0.7 : softs.reduce(0,+) / Double(softs.count)
        let least = softs.min() ?? 0.7
        let spread = (softs.max() ?? 0.7) - least
        let penalty = zip(members,softs).map { (1 - $0.1) * (0.5 + $0.0.sacrificeLoad) }
        let fairness = clamp(1 - spread * 0.65 - (penalty.isEmpty ? 0 : penalty.reduce(0,+) / Double(penalty.count)) * 0.35)
        let group = avg * 0.55 + least * 0.45
        var score = Int((100 * (group * 0.62 + fairness * 0.28 + ratio * 0.1)).rounded())
        if !feasible { score = max(12, Int((Double(score) * 0.45).rounded()) - blocked * 6) }
        score = max(0,min(99,score))
        func fit(_ kinds: [String]) -> Int {
            let count = kinds.reduce(0) { result, kind in result + e.filter { $0.kinds.contains(kind) }.count }
            return Int((clamp(1 - Double(count) / Double(max(1,members.count))) * 100).rounded())
        }
        var reasons: [String] = [], cautions: [String] = []
        if feasible {
            reasons = ["Fits every group member’s spending limit", "Works with everyone’s available times", option.requiresDriving ? "Transportation covers everyone who needs a ride" : "No transportation required"]
            if avg > 0.7 { reasons.append("Matches most stated preferences") }
            if least < 0.45 { cautions.append("One member’s preferences are only partly met") }
            if option.travelMinutes > 25 { cautions.append("Travel time is on the longer side for this group") }
        } else {
            cautions.append("This option does not meet every member’s requirements")
            if !transportOK { cautions.append("There aren’t enough seats to get everyone there and back") }
        }
        return OptionScore(option: option, score: score, feasible: feasible, hardFailures: blocked + (transportOK ? 0 : 1), budgetFit: fit(["budget"]), scheduleFit: fit(["schedule","curfew"]), travelFit: fit(["travel"]), dietaryFit: fit(["dietary"]), preferenceFit: Int((avg*100).rounded()), transportFit: Int((ratio*100).rounded()), fairness: Int((fairness*100).rounded()), overallFit: Int((group*100).rounded()), reasons: reasons, cautions: cautions)
    }
    static func rank(_ options: [PlanOption], members: [DemoMember]) -> [OptionScore] {
        options.enumerated().map { ($0.offset,score($0.element,members:members)) }.sorted {
            if $0.1.feasible != $1.1.feasible { return $0.1.feasible }
            if $0.1.score != $1.1.score { return $0.1.score > $1.1.score }
            if $0.1.fairness != $1.1.fairness { return $0.1.fairness > $1.1.fairness }
            return $0.0 < $1.0
        }.map { $0.1 }
    }
    static func options(_ catalog: [PlanOption], category: String) -> [PlanOption] {
        let direct = catalog.filter { $0.category.contains(category) }
        return direct.count >= 4 ? direct : Array((direct + catalog.filter { !direct.contains($0) }).prefix(8))
    }
    static func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json") else { throw ServiceFailure(message: "The offline sample couldn’t be loaded.") }
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }
}
