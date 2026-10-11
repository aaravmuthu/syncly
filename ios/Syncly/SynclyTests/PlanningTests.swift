import Foundation
import Testing
@testable import Syncly

private final class FixtureAnchor: NSObject {}
private nonisolated struct ScoreFixture: Decodable, Sendable {
    let name: String
    let option: PlanOption
    let members: [DemoMember]
    let score: Int, hardFailures: Int, budgetFit: Int, scheduleFit: Int, travelFit: Int, dietaryFit: Int, preferenceFit: Int, transportFit: Int, fairness: Int, overallFit: Int
    let feasible: Bool
}
private nonisolated struct CostFixture: Decodable, Sendable { struct Line:Decodable,Sendable {let label:String;let value:String};let lines:[Line]; let option: PlanOption; let category: String; let headcount: Int; let perPersonMin: Int,perPersonMax: Int,groupMin: Int,groupMax: Int; let travel: Double }
private nonisolated struct ItineraryFixture:Decodable {
    struct Input:Decodable {let start:String;let stops:[ItineraryStop]}
    struct Expected:Decodable {struct Stop:Decodable {let start:String;let end:String;let driveMinutes:Int?;let driveMiles:Double?};let stops:[Stop];let end:String;let totalMinutes:Int}
    struct Cost:Decodable {let min:Double;let max:Double}
    let input:Input;let expected:Expected;let cost:Cost
}
struct PlanningTests {
    private func load<T:Decodable>(_ name: String,as type:T.Type) throws -> T {
        let url = try #require(Bundle(for:FixtureAnchor.self).url(forResource:name,withExtension:"json"))
        return try JSONDecoder().decode(type,from:Data(contentsOf:url))
    }
    @Test func itinerariesMatchWebAcrossMidnightMissingPicksAndFallbacks() throws {
        for f in try load("ItineraryFixtures",as:[ItineraryFixture].self) {
            let itinerary=NativeItinerary(version:1,title:"Fixture",vibe:"Test",date:nil,start:f.input.start,budgetPerPerson:nil,areaLabel:nil,zip:nil,anchor:0,stops:f.input.stops,invite:"Test",weather:nil)
            let result=itinerary.timeline
            #expect(result.end == f.expected.end && result.totalMinutes == f.expected.totalMinutes)
            for (actual,expected) in zip(result.stops,f.expected.stops) {
                #expect(actual.start == expected.start && actual.end == expected.end)
                #expect(actual.driveMinutes == expected.driveMinutes && actual.driveMiles == expected.driveMiles)
            }
            #expect(itinerary.costRange.0 == f.cost.min && itinerary.costRange.1 == f.cost.max)
            let wire=try JSONValue.encoded(itinerary)
            #expect(["date","budgetPerPerson","areaLabel","zip","weather"].allSatisfy {wire.fields.keys.contains($0) && wire[$0] == .null})
        }
    }
    @Test func sampleGroupsAndSelectedParticipantsHaveConsistentRosters() async throws {
        let demo=try DemoService()
        let group=try await demo.call("createGroup",.object(["name":.string("Small group"),"emoji":.string("🌿"),"kind":.string("permanent")]))
        let detail=try await demo.call("getGroup",.object(["groupId":group["id"]]))
        #expect(detail["members"].items.count == 1)
        let plan=try await demo.call("createPlan",.object(["groupId":group["id"],"title":.string("Solo test"),"category":.string("hangout"),"participantIds":.array([])]))
        let planDetail=try await demo.call("getPlan",.object(["planId":plan["id"]]))
        #expect(planDetail["participants"].items.count == 1)
    }
    @Test func teenCheckinReplyClosesOnlyTheRequestedPendingItem() async throws {
        let demo=try DemoService()
        _ = try await demo.call("askForCheckin",.object(["teenProfileId":.string(DemoService.myID),"note":.string("Are you okay?")]))
        let pending=try await demo.call("getMyCheckins",.object([:]))
        let request=try #require(pending.items.first)
        _ = try await demo.call("respondToCheckin",.object(["id":request["id"],"placeLabel":.string("Cafe")]))
        #expect(try await demo.call("getMyCheckins",.object([:])).items.isEmpty)
        await #expect(throws:ServiceFailure.self) {try await demo.call("respondToCheckin",.object(["id":request["id"]]))}
    }
    @Test func moneyFormattingPreservesCents() {
        #expect(CostEstimate.moneyRange(1.25,2.5) == "$1.25–$2.50")
        #expect(CostEstimate.moneyRange(2,2) == "$2")
    }
    @Test func sampleApprovalDecisionsAreScopedToOnePlan() async throws {
        let demo=try DemoService()
        let newPlan=try await demo.call("createPlan",.object(["groupId":.string(DemoService.groupID),"title":.string("Another plan"),"category":.string("hangout"),"participantIds":.array([])]))
        _ = try await demo.call("requestParentApproval",.object(["planId":newPlan["id"]]))
        let original=try await demo.call("getPlan",.object(["planId":.string(DemoService.planID)]))
        let id=try #require(original["approvals"].items.first?["id"])
        _ = try await demo.call("decidePlanApproval",.object(["approvalId":id,"decision":.string("approved_with_condition"),"condition":.string("Home by 10")]))
        let changed=try await demo.call("getPlan",.object(["planId":.string(DemoService.planID)]))
        let unchanged=try await demo.call("getPlan",.object(["planId":newPlan["id"]]))
        #expect(changed["approvals"].items.first?["status"].text == "approved_with_condition")
        #expect(unchanged["approvals"].items.first?["status"].text == "pending")
    }
    @Test func cancelingSampleTrialKeepsPeriodAccessAndCannotReuseTrial() async throws {
        let demo=try DemoService()
        _ = try await demo.call("startFamilyPlus",.object(["interval":.string("month")]))
        _ = try await demo.call("cancelFamilyPlus",.object([:]))
        let state=try await demo.call("getMyFamilyPlan",.object([:]))
        #expect(state["tier"].text == "plus" && state["status"].text == "canceled")
        #expect(!state["trialAvailable"].flag && !state["periodEnd"].text.isEmpty)
        await #expect(throws:ServiceFailure.self) {try await demo.call("startFamilyPlus",.object(["interval":.string("year")]))}
    }
    @Test func decliningSampleAttendanceChangesAggregateCounts() async throws {
        let demo=try DemoService()
        let before=try await demo.call("getAvailabilityHeatmap",.object(["planId":.string(DemoService.planID)]))
        _ = try await demo.call("confirmAttendance",.object(["planId":.string(DemoService.planID),"attending":.bool(false)]))
        let after=try await demo.call("getAvailabilityHeatmap",.object(["planId":.string(DemoService.planID)]))
        #expect(before["total"].number == 4 && after["total"].number == 3)
    }
    @Test func scoresMatchEveryWebFixture() throws {
        for f in try load("EngineFixtures",as:[ScoreFixture].self) {
            let r = PlanningEngine.score(f.option,members:f.members)
            #expect(r.score == f.score,"\(f.name)")
            #expect(r.feasible == f.feasible,"\(f.name)")
            #expect(r.hardFailures == f.hardFailures,"\(f.name)")
            #expect(r.budgetFit == f.budgetFit && r.scheduleFit == f.scheduleFit && r.travelFit == f.travelFit && r.dietaryFit == f.dietaryFit,"\(f.name)")
            #expect(r.preferenceFit == f.preferenceFit && r.transportFit == f.transportFit && r.fairness == f.fairness && r.overallFit == f.overallFit,"\(f.name)")
        }
    }
    @Test func costEstimatesMatchWebAndExcludeWalkableCarCosts() throws {
        for f in try load("CostFixtures",as:[CostFixture].self) {
            let r = CostEstimate.estimate(option:f.option,category:f.category,headcount:f.headcount)
            #expect(r.perPersonMin == f.perPersonMin && r.perPersonMax == f.perPersonMax)
            #expect(r.groupMin == f.groupMin && r.groupMax == f.groupMax && r.travel == f.travel)
            #expect(r.lines.map { $0.0 } == f.lines.map(\.label))
            #expect(r.lines.map { $0.1 } == f.lines.map(\.value))
            if !f.option.requiresDriving {#expect(!r.lines.contains {$0.0.hasPrefix("Travel")})}
        }
    }
    @Test func hardDietaryFailuresNeverBecomeFeasibleThroughFairness() throws {
        let f = try #require(load("EngineFixtures",as:[ScoreFixture].self).first {$0.name == "baseline-bowling"})
        let result = PlanningEngine.score(f.option,members:f.members)
        #expect(!result.feasible)
        #expect(result.dietaryFit < 100)
    }
    @Test func parentConditionsAndCurfewsUseEveningAndReturnTravel() {
        #expect(PlanningEngine.homeBy("Must be home by 10") == 22*60)
        #expect(PlanningEngine.homeBy("Home by 10:30 PM") == 22*60+30)
        #expect(PlanningEngine.homeBy("12 am") == 0)
        #expect(PlanningEngine.homeBy("No time supplied") == nil)
    }
    @Test func availabilityChoosesLongestPeakAndFirstTie() {
        let result = PlanningHelpers.bestWindow([("11:00",1,4),("12:00",3,4),("13:00",3,4),("14:00",2,4),("15:00",3,4)])
        #expect(result?.0 == "12:00" && result?.1 == "13:00")
        #expect(PlanningHelpers.bestWindow([("11:00",0,4)]) == nil)
    }
    @Test func expiryIsStrictAndNoTimePlansStayOpen() {
        let base = Date(timeIntervalSince1970:100000)
        #expect(!PlanningHelpers.isOver(start:base,end:nil,now:base.addingTimeInterval(14400)))
        #expect(PlanningHelpers.isOver(start:base,end:nil,now:base.addingTimeInterval(14401)))
        #expect(!PlanningHelpers.isOver(start:nil,end:nil,now:base))
        #expect(!PlanningHelpers.canEdit("finalized"))
    }
    @Test func calendarPreservesLocalDateOvernightAndUnicodeFolding() throws {
        let zone = try #require(TimeZone(identifier:"America/Chicago"))
        let (first,last) = CalendarExport.dates(date:"2026-07-10",start:"23:00",end:"01:00",timeZone:zone)
        #expect(first.ISO8601Format() == "2026-07-11T04:00:00Z")
        #expect(last.ISO8601Format() == "2026-07-11T06:00:00Z")
        let folded = CalendarExport.fold("SUMMARY:"+String(repeating:"🌿",count:50))
        #expect(folded.components(separatedBy:"\r\n").allSatisfy {$0.utf8.count <= 75})
        #expect(folded.replacingOccurrences(of:"\r\n ",with:"") == "SUMMARY:"+String(repeating:"🌿",count:50))
    }
    @Test func uploadSniffingChecksBytesAndBounds() throws {
        #expect(SafeUpload.imageType(Data([255,216,255]))?.1 == "jpg")
        #expect(SafeUpload.imageType(Data("not-a-picture.png".utf8)) == nil)
        #expect(throws:ServiceFailure.self) {try SafeUpload.image(Data(repeating:0,count:5*1024*1024+1))}
        #expect(throws:ServiceFailure.self) {try SafeUpload.audio(Data("not-a-voice.m4a".utf8))}
    }
    @Test func consentExpiresAndNeverAcceptsFutureSavedChoices() throws {
        let prefs = try #require(UserDefaults(suiteName:"SynclyConsentTests.\(UUID().uuidString)"))
        let now = Date(timeIntervalSince1970:1000000)
        NativeConsent.save(analytics:true,marketing:false,preferences:prefs,now:now)
        #expect(NativeConsent.load(preferences:prefs,now:now)?.analytics == true)
        #expect(NativeConsent.load(preferences:prefs,now:now.addingTimeInterval(180*86400)) == nil)
        #expect(NativeConsent.load(preferences:prefs,now:now.addingTimeInterval(-1)) == nil)
        prefs.removeObject(forKey:"syncly.privacy-consent")
    }
    @Test func demoPlanMutationInvalidatesResultsAndCannotFinalizeBlockedOption() async throws {
        let demo = try DemoService()
        let body:JSONValue = .object(["planId":.string(DemoService.planID)])
        _ = try await demo.call("submitConstraints",.object(["planId":.string(DemoService.planID),"payload":.object(["maxSpend":.number(0),"latestEnd":.string("18:00")])]))
        _ = try await demo.call("generateRecommendations",body)
        let detail = try await demo.call("getPlan",body)
        let blocked = try #require(detail["recommendations"].items.first {!$0["feasible"].flag})
        await #expect(throws:ServiceFailure.self) {try await demo.call("finalizePlan",.object(["planId":.string(DemoService.planID),"recommendationId":blocked["id"]]))}
        _ = try await demo.call("submitConstraints",.object(["planId":.string(DemoService.planID),"payload":.object(["maxSpend":.number(5)])]))
        let refreshed = try await demo.call("getPlan",body)
        #expect(refreshed["recommendations"].items.isEmpty)
        #expect(refreshed["plan"]["status"].text == "collecting")
        #expect(refreshed.fields.keys.contains("myConstraints"))
        #expect(!refreshed.fields.keys.contains("constraints"))
        #expect(refreshed["participants"].items.allSatisfy {$0["constraints"] == .null})
    }
}
