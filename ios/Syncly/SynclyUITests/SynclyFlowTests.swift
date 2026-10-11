import XCTest

final class SynclyFlowTests:XCTestCase {
    @MainActor func testDemoPlanAndGuardianFlows() throws {
        continueAfterFailure=false
        let app=XCUIApplication()
        defer {app.terminate()}
        app.launchArguments=["--demo"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Groups"].waitForExistence(timeout:30))
        app.tabBars.buttons["Groups"].tap()
        app.buttons["Create or join group"].tap()
        app.buttons["Create group"].tap()
        let name=app.textFields["Name"]
        XCTAssertTrue(name.waitForExistence(timeout:10));name.tap();name.typeText("Weekend crew")
        reveal(app.buttons["Create group"],in:app);app.buttons["Create group"].tap()
        XCTAssertTrue(app.staticTexts["Weekend crew"].waitForExistence(timeout:10))

        app.tabBars.buttons["Home"].tap()
        reveal(app.buttons["Create a plan"],in:app);app.buttons["Create a plan"].tap()
        let title=app.textFields["Title"]
        XCTAssertTrue(title.waitForExistence(timeout:10));title.tap();title.typeText("Saturday coffee")
        reveal(app.buttons["Launch plan"],in:app);app.buttons["Launch plan"].tap()
        XCTAssertTrue(app.staticTexts["Saturday coffee"].waitForExistence(timeout:10))
        app.staticTexts["Saturday coffee"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Your private answers"].waitForExistence(timeout:10));app.buttons["Your private answers"].tap()
        let budget=app.textFields["Maximum per person ($), optional"]
        XCTAssertTrue(budget.waitForExistence(timeout:10));budget.tap();budget.typeText("20")
        reveal(app.buttons["Save private answers"],in:app);app.buttons["Save private answers"].tap()
        reveal(app.buttons["Find compatible options"],in:app);app.buttons["Find compatible options"].tap()
        reveal(app.staticTexts["Foxglove Cafe"].firstMatch,in:app);app.staticTexts["Foxglove Cafe"].firstMatch.tap()
        reveal(app.buttons["Vote for this option"],in:app);app.buttons["Vote for this option"].tap()
        app.buttons["Lock in this plan"].tap();confirm("Lock in this plan",in:app)
        XCTAssertTrue(app.staticTexts["Locked-in plan"].waitForExistence(timeout:10))
        XCTAssertTrue(app.staticTexts["Foxglove Cafe"].exists)
        attach(app,"Finalized native plan")

        app.tabBars.buttons["Home"].tap()
        for _ in 0..<5 {
            if app.navigationBars["Syncly"].exists {break}
            let back=app.navigationBars.buttons.firstMatch
            guard back.exists && back.label != "Settings" else {break}
            back.tap()
        }
        reveal(app.buttons["Family hub"],in:app);app.buttons["Family hub"].tap()
        app.buttons["My linked guardians"].tap()
        app.buttons["Unlink guardian"].tap();confirm("Unlink guardian",in:app)
        app.navigationBars.buttons.firstMatch.tap()
        let code=app.textFields["Teen’s Sync code"]
        XCTAssertTrue(code.waitForExistence(timeout:10));code.tap();code.typeText("DEMO123")
        app.buttons["Send link request"].tap()
        reveal(app.buttons["My linked guardians"],in:app);app.buttons["My linked guardians"].tap()
        XCTAssertTrue(app.buttons["Approve link"].waitForExistence(timeout:10));app.buttons["Approve link"].tap()
        XCTAssertTrue(app.buttons["Unlink guardian"].waitForExistence(timeout:10))
        attach(app,"Teen-approved guardian link")
        app.navigationBars.buttons.firstMatch.tap()
        let teen=app.buttons.matching(identifier:"family-teen-10000000-0000-4000-8000-000000000003").firstMatch
        XCTAssertTrue(teen.waitForExistence(timeout:10));reveal(teen,in:app);teen.tap()
        let approval=app.buttons.matching(identifier:"review-approval-10000000-0000-4000-8000-000000000002").firstMatch
        reveal(approval,in:app);approval.tap()
        let condition=app.descendants(matching:.any).matching(identifier:"guardian-condition").firstMatch
        XCTAssertTrue(condition.waitForExistence(timeout:10));condition.tap();condition.typeText("Be home by 9 PM")
        reveal(app.buttons["Approve with condition"],in:app);app.buttons["Approve with condition"].tap()
        XCTAssertTrue(approval.waitForExistence(timeout:10))
        XCTAssertTrue(approval.label.contains("Approved With Condition") || approval.label.contains("Approved with condition"))
        attach(app,"Guardian condition saved")
        reveal(app.buttons["Request check-in"],in:app);app.buttons["Request check-in"].tap()
        app.navigationBars.buttons.firstMatch.tap()
        attach(app,"Returned family hub")
        reveal(app.buttons["My check-ins"],in:app);app.buttons["My check-ins"].tap()
        XCTAssertTrue(app.buttons["Reply: I’m okay"].waitForExistence(timeout:10));app.buttons["Reply: I’m okay"].tap()
        XCTAssertTrue(app.staticTexts["No pending requests"].waitForExistence(timeout:10))
        attach(app,"Teen check-in replied")
        app.terminate()
    }
    @MainActor private func confirm(_ title:String,in app:XCUIApplication) {
        let action=app.buttons.matching(identifier:"confirm-" + title).firstMatch
        XCTAssertTrue(action.waitForExistence(timeout:10))
        action.tap()
    }
    @MainActor private func reveal(_ element:XCUIElement,in app:XCUIApplication) {
        for _ in 0..<10 {if element.exists && element.isHittable {return};app.swipeUp()}
        attach(app,"Unreachable control")
        XCTAssertTrue(element.exists && element.isHittable,"Expected control is reachable: " + element.description)
    }
    @MainActor private func attach(_ app:XCUIApplication,_ name:String) {let screenshot=app.screenshot();let path=URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent(name.replacingOccurrences(of:" ",with:"-")+".png");try? screenshot.pngRepresentation.write(to:path);print("UI snapshot: " + path.path);let shot=XCTAttachment(screenshot:screenshot);shot.name=name;shot.lifetime = .keepAlways;add(shot)}
}
