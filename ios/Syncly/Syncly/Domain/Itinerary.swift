import Foundation

nonisolated struct ItineraryVenue: Codable, Sendable, Identifiable {
    let key: String
    let title: String
    let address: String?
    let lat: Double
    let lon: Double
    let costMin: Double
    let costMax: Double
    let rating: Double?
    var id: String {key}
    enum CodingKeys: String,CodingKey {case key,title,address,lat,lon,costMin,costMax,rating}
    func encode(to encoder:any Encoder) throws {var c=encoder.container(keyedBy:CodingKeys.self);try c.encode(key,forKey:.key);try c.encode(title,forKey:.title);try c.encode(address,forKey:.address);try c.encode(lat,forKey:.lat);try c.encode(lon,forKey:.lon);try c.encode(costMin,forKey:.costMin);try c.encode(costMax,forKey:.costMax);try c.encode(rating,forKey:.rating)}
}
nonisolated struct ItineraryStop: Codable, Sendable, Identifiable {
    let id: String
    let kind: String
    var label: String
    let why: String
    var minutes: Int
    var options: [ItineraryVenue]
    var pick: Int
    var chosen: ItineraryVenue? {options.indices.contains(pick) ? options[pick] : options.first}
}
nonisolated struct ItineraryWeather: Codable,Sendable {let emoji: String;let line: String;let outdoorRisk: Bool}
nonisolated struct NativeItinerary: Codable,Sendable {
    let version: Int
    var title: String
    let vibe: String
    var date: String?
    var start: String
    let budgetPerPerson: Double?
    var areaLabel: String?
    var zip: String?
    var anchor: Int
    var stops: [ItineraryStop]
    let invite: String
    var weather: ItineraryWeather?
    enum CodingKeys:String,CodingKey {case version,title,vibe,date,start,budgetPerPerson,areaLabel,zip,anchor,stops,invite,weather}
    func encode(to encoder:any Encoder) throws {var c=encoder.container(keyedBy:CodingKeys.self);try c.encode(version,forKey:.version);try c.encode(title,forKey:.title);try c.encode(vibe,forKey:.vibe);try c.encode(date,forKey:.date);try c.encode(start,forKey:.start);try c.encode(budgetPerPerson,forKey:.budgetPerPerson);try c.encode(areaLabel,forKey:.areaLabel);try c.encode(zip,forKey:.zip);try c.encode(anchor,forKey:.anchor);try c.encode(stops,forKey:.stops);try c.encode(invite,forKey:.invite);try c.encode(weather,forKey:.weather)}
    struct TimedStop: Sendable {let stop: ItineraryStop;let start: String;let end: String;let driveMinutes: Int?;let driveMiles: Double?}
    var timeline: (stops:[TimedStop],end:String,totalMinutes:Int) {
        var clock = Int(PlanningEngine.minutes(start) ?? 0);let initial = clock
        var previous: ItineraryVenue?
        let rows = stops.map {stop in
            let here = stop.chosen
            var drive: Int?,miles: Double?
            if let previous,let here {let distance = (GeoMath.miles(lat:previous.lat,lon:previous.lon,toLat:here.lat,toLon:here.lon)*10).rounded()/10;miles = distance;drive = distance < 0.3 ? 2 : GeoMath.driveMinutes(distance);clock += drive ?? 0}
            let start = Self.clock(clock);clock += stop.minutes;previous = here ?? previous
            return TimedStop(stop:stop,start:start,end:Self.clock(clock),driveMinutes:drive,driveMiles:miles)
        }
        return (rows,Self.clock(clock),clock-initial)
    }
    var costRange: (Double,Double) {stops.reduce((0,0)) {result,stop in guard let v=stop.chosen else {return result};return (result.0+v.costMin,result.1+v.costMax)}}
    static func clock(_ minutes:Int)->String {let m=((minutes%1440)+1440)%1440;return String(format:"%02d:%02d",m/60,m%60)}
    static func draft(_ value:JSONValue,origin:JSONValue) throws -> Self {
        var fields=value.fields
        let stops=value["stops"].items.map {value in var f=value.fields;f["options"] = .array([]);f["pick"] = .number(0);return JSONValue.object(f)}
        fields["stops"] = .array(stops);fields["areaLabel"] = origin["label"];fields["zip"] = origin["zip"];fields["weather"] = .null
        return try JSONValue.object(fields).decoded(Self.self)
    }
}
nonisolated enum GeoMath {
    static func miles(lat:Double,lon:Double,toLat:Double,toLon:Double)->Double {
        let a=(toLat-lat)*Double.pi/180,b=(toLon-lon)*Double.pi/180
        let s=pow(sin(a/2),2)+cos(lat*Double.pi/180)*cos(toLat*Double.pi/180)*pow(sin(b/2),2)
        return 2*3958.7613*asin(min(1,sqrt(s)))
    }
    static func driveMinutes(_ miles:Double)->Int {max(3,Int((miles*2.1+3).rounded()))}
}
