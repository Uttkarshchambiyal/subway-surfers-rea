import Foundation

struct GameConfig {
    var values: [String: Any] = [:]
    init(data: Data? = nil) { if let data, let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any] { values = object } }
    func n(_ key: String, _ fallback: Double) -> Double { (values[key] as? NSNumber)?.doubleValue ?? fallback }
    var dt: Double { n("fixedStep",1/120) }
}
struct SaveData: Codable {
    var schemaVersion = 1, best = 0, wallet = 0, totalCoins = 0, runs = 0, boards = 3
    var totalDistance = 0.0, selectedSkin = "coral", unlocked = ["coral"], claimed: [String] = []
    var muted = false, volume = 0.55
    static func read() -> SaveData { guard let d = UserDefaults.standard.data(forKey:"railrush.save.v1"), let s = try? JSONDecoder().decode(SaveData.self,from:d), s.wallet >= 0, s.boards >= 0, s.schemaVersion == 1 else { return SaveData() }; return s }
    func write() { if ProcessInfo.processInfo.environment["RAILRUSH_TESTS"] == "1" { return }; if let d = try? JSONEncoder().encode(self) { UserDefaults.standard.set(d,forKey:"railrush.save.v1") } }
}
struct RouteItem: Codable {
    var id: String; var kind: String; var lane: Int; var z: Double; var y: Double; var length: Double
    enum CodingKeys:String,CodingKey {case id,kind,lane,z,y,length}
    init(id:String,kind:String,lane:Int,z:Double,y:Double,length:Double) {self.id=id;self.kind=kind;self.lane=lane;self.z=z;self.y=y;self.length=length}
    init(from decoder:Decoder) throws {let c=try decoder.container(keyedBy:CodingKeys.self);if let number=try? c.decode(Int.self,forKey:.id) {id=String(number)} else {id=try c.decode(String.self,forKey:.id)};kind=try c.decode(String.self,forKey:.kind);lane=try c.decode(Int.self,forKey:.lane);z=try c.decode(Double.self,forKey:.z);y=try c.decode(Double.self,forKey:.y);length=try c.decode(Double.self,forKey:.length)}
}
struct CoinFlight {var elapsed:Double;var duration:Double;var x:Double;var y:Double;var z:Double}
struct ActiveItem { var data: RouteItem; var z: Double; var previousZ: Double; var consumed = false;var attraction:CoinFlight? = nil }
enum RunState: String { case menu, starting, running, paused, collision, results }
final class GameEngine {
    let config: GameConfig
    var route: [RouteItem]
    var save: SaveData
    var state: RunState = .menu, pausedFrom: RunState = .running
    var distance = 0.0, speed = 12.0, elapsed = 0.0, x = 0.0, y = 0.0, vy = 0.0, floor = 0.0
    var lane = 0, coins = 0, score = 0, distanceScore = 0, phaseTime = 0.0, roll = 0.0, grace = 0.0
    var laneTravel = 0.0, laneFrom = 0.0, laneTime = 1.0, laneDuration = 0.27, lastLaneDistance = -Double.infinity, groundedAgo = 0.0, accumulator = 0.0
    var grounded = true
    var powers: [String: Double] = [:], items: [ActiveItem] = [], events: [String] = []
    var nextRow = 0, settled = false
    private var rows: [[RouteItem]] = []
    init(config: GameConfig = GameConfig(), route: [RouteItem] = [], save: SaveData = SaveData.read()) {
        self.config = config; self.route = route; self.save = save
        self.route = route.sorted { $0.z == $1.z ? (Int($0.id) ?? 0) < (Int($1.id) ?? 0) : $0.z < $1.z }
    }

    func start() {
        settle(); distance = 0; speed = config.n("initialSpeed",12); elapsed = 0; x = 0; y = 0; vy = 0; floor = 0
        lane = 0; coins = 0; score = 0; distanceScore = 0; phaseTime = 0; roll = 0; grace = 0; laneFrom = 0; laneTime = 1
        accumulator = 0; powers.removeAll(keepingCapacity:true); items.removeAll(keepingCapacity:true); events.removeAll(keepingCapacity:true)
        nextRow = 0; settled = false; grounded = true; groundedAgo = 0; lastLaneDistance = -.infinity; laneTravel = 0; laneDuration = config.n("laneChangeSeconds",0.27); state = .starting; spawn(); emit("start")
    }
    func emit(_ event: String) { if events.count < 32 { events.append(event) } }
    func pause() { if state == .running || state == .starting { pausedFrom = state; state = .paused; accumulator = 0 } }
    func resume() { if state == .paused { state = pausedFrom; accumulator = 0 } }
    func menu() { settle(); state = .menu; accumulator = 0 }
    func settle() { guard !settled, state != .menu else { return }; settled = true; save.wallet += coins; save.totalCoins += coins; save.totalDistance += distance; save.runs += 1; save.best = max(save.best,score); save.write() }
    func move(_ delta: Int) {guard state == .running else{return};let width=config.n("laneWidth",3.888888888889),changing=laneTime<1;if changing && ((Double(lane)*width-laneFrom)*Double(delta)>=0 || laneTravel<config.n("minimumLaneChangeTravel",0.291666666667)){return};var target=Int((x/width).rounded(.toNearestOrEven))+(changing ? 0:delta);if changing && Int((laneFrom/width).rounded(.toNearestOrEven)) != target {target+=delta};guard (-1...1).contains(target),abs(Double(target)*width-x)>1e-9 else{return};lastLaneDistance=distance;laneDuration=config.n(powers["jetpack",default:0]>0 ? "jetpackLaneChangeSeconds":"laneChangeSeconds",0.27)/max(1,speed/config.n("initialSpeed",21.388888888889))*(changing ? abs(Double(target)-x/width):1);lane=target;laneFrom=x;laneTime=0;laneTravel=0;emit("lane") }
    func jump() { guard state == .running, (grounded || groundedAgo < config.n("groundedJumpGraceSeconds",0.15)), powers["jetpack",default:0] <= 0 else{return}; grounded = false; groundedAgo = 100; vy = config.n(powers["boots",default:0] > 0 ? "superJumpVelocity":"jumpVelocity", powers["boots",default:0] > 0 ? 14:10); roll = 0; emit("jump") }
    func slide() { guard state == .running, powers["jetpack",default:0] <= 0 else{return}; roll = config.n("rollSeconds",0.7); if !grounded { vy = min(vy,config.n("diveVelocity",-17.5)) }; emit("roll") }
    func board() { guard state == .running, powers["board",default:0] <= 0, save.boards > 0 else{return}; save.boards -= 1; save.write(); activate("board") }
    func activate(_ kind:String) { powers[kind] = config.n(kind+"Seconds",kind == "board" ? 20:12); emit("power") }
    func buySkin(_ id:String) { let cost = id == "mint" ? 120:240; if save.unlocked.contains(id) {save.selectedSkin = id} else if save.wallet >= cost { save.wallet -= cost; save.unlocked.append(id); save.selectedSkin = id }; save.write() }
    func buyBoards() { if save.wallet >= 30 { save.wallet -= 30; save.boards += 3; save.write() } }
    func claim(_ id:String) { guard !save.claimed.contains(id) else{return}; let met = id == "coins25" ? save.totalCoins >= 25 : id == "distance1000" ? save.totalDistance >= 1000 : save.runs >= 3; guard met else{return}; save.wallet += id == "coins25" ? 40 : id == "distance1000" ? 60:30; save.claimed.append(id); save.write() }
    func advance(_ delta:Double) { guard state != .paused && state != .menu && state != .results else{return}; accumulator += min(0.05,max(0,delta)); while accumulator >= config.dt { tick(config.dt); accumulator -= config.dt } }
    func spawn() {
        guard !route.isEmpty else{return}
        let cycleLength = config.n("routeCycleLength",6144)
        while true {
            let cycle = nextRow / route.count
            var data = route[nextRow % route.count]
            data.z += Double(cycle)*cycleLength
            if data.z > distance + config.n("generationAhead",300) {break}
            data.id += "@\(cycle)"
            items.append(ActiveItem(data:data,z:data.z,previousZ:data.z))
            nextRow += 1
        }
    }

    private func advanceAttractions(_ dt:Double) {
        for i in items.indices where !items[i].consumed && items[i].attraction != nil {
            items[i].attraction!.elapsed += dt
            if items[i].attraction!.elapsed >= items[i].attraction!.duration {items[i].consumed=true;items[i].attraction=nil;coins+=1;emit("coin")}
        }
        score=distanceScore+coins*10
    }
    func tick(_ dt:Double) {
        if state == .starting { phaseTime += dt; if phaseTime >= 0.8 {state = .running;phaseTime = 0}; return }
        if state == .collision {advanceAttractions(dt);phaseTime += dt; if phaseTime >= 0.6 {state = .results;settle()}; return}
        guard state == .running else{return}
        advanceAttractions(dt)
        let oldD = distance, oldY = y
        groundedAgo = grounded ? 0 : groundedAgo+dt
        elapsed += dt; speed = min(config.n("maxSpeed",26),speed + config.n("acceleration",0.085)*dt); distance += speed*dt
        laneTime = min(1,laneTime+dt/laneDuration); let s = laneTime, oldX=x; x = laneFrom + (Double(lane)*config.n("laneWidth",3.888888888888889)-laneFrom)*s; laneTravel+=abs(x-oldX)
        roll = max(0,roll-dt); grace = max(0,grace-dt)
        for key in Array(powers.keys) { let old = powers[key]!; powers[key] = max(0,old-dt); if key == "jetpack", old > 0, powers[key] == 0 {grace = config.n("landingGraceSeconds",1.5);vy = 0;grounded = false} }
        for i in items.indices { items[i].previousZ = items[i].z; if items[i].data.kind == "movingTrain" {items[i].z -= 4*dt} }
        var support = 0.0
        for item in items where !item.consumed {
            let a = item.data; guard abs(x-Double(a.lane)*config.n("laneWidth",3.888888888888889)) <= 1.1 else{continue}
            let rel = distance-item.z
            if a.kind == "ramp", rel >= 0, rel <= a.length { support = max(support,3*min(1,(rel+config.n("playerRadius",0.36))/a.length)) }
            if (a.kind == "train" || a.kind == "movingTrain"), rel >= -0.1, rel <= a.length+0.1, oldY >= 2.9 {support = max(support,3)}
        }
        floor = support
        if powers["jetpack",default:0] > 0 {y += (config.n("jetpackHeight",8)-y)*min(1,dt*config.n("jetpackSmoothing",6));vy = 0;roll = 0;grounded = false;groundedAgo = 100} else if grounded && y <= support+0.16 {y = support;vy = 0} else {grounded = false;vy -= config.n("gravity",28)*dt; y += vy*dt; if y <= support && vy <= 0 {y = support;vy = 0;grounded = true}}
        let height = roll > 0 ? config.n("rollingHeight",0.65):config.n("standingHeight",1.75)
        for i in items.indices where !items[i].consumed {
            let a = items[i].data, dx = abs(x-Double(a.lane)*config.n("laneWidth",3.888888888888889)), z = items[i].z, dz = z-distance
            let near = z <= distance+0.32 && z+a.length >= oldD-0.32
            if a.kind == "coin" {
                let centre = y + (roll > 0 ? 0.32:0.9)
                if items[i].attraction == nil {
                    let range=hypot(dx,dz)
                    if powers["magnet",default:0]>0 && range<config.n("magnetAttractionRadius",10.5) && abs(a.y-centre)<4 {
                        items[i].attraction=CoinFlight(elapsed:0,duration:config.n("magnetFlightBaseSeconds",0.34)+range*config.n("magnetFlightSecondsPerUnit",0.02),x:Double(a.lane)*config.n("laneWidth",3.8888888889),y:a.y,z:distance-z)
                    } else if dx<config.n("coinPickupHalfWidth",0.65) && z >= oldD-config.n("coinPickupHalfDepth",0.7) && z <= distance+config.n("coinPickupHalfDepth",0.7) && abs(a.y-centre)<config.n("coinPickupHalfHeight",0.85) {items[i].consumed=true;coins+=1;emit("coin")}
                }
            } else if ["magnet","jetpack","boots","multiplier","board"].contains(a.kind) {
                if dx<1 && z >= oldD-1 && z <= distance+1 && abs(a.y-y-(roll>0 ? 0.32:0.9))<1.4 {items[i].consumed=true;activate(a.kind)}
            } else if near && dx < config.n("collisionHalfWidth",1.46) && powers["jetpack",default:0] <= 0 && grace <= 0 && a.kind != "ramp" {
                let hit = a.kind == "barrier" ? y < 1.05 : a.kind == "overhead" ? y < 2.6 && y+height>1.1 : y < 2.92
                if hit {
                    if powers["board",default:0] > 0 {powers["board"] = 0;grace = config.n("boardGraceSeconds",1); for j in items.indices where abs(items[j].z-distance)<16 && items[j].data.kind != "coin" {items[j].consumed = true};emit("shield")}
                    else {state = .collision;phaseTime=0;emit("crash");break}
                }
            }
        }
        distanceScore += Int(floorValue(distance)-floorValue(oldD))*3*(powers["multiplier",default:0]>0 ? 2:1)
        score = distanceScore+coins*10
        items.removeAll {($0.attraction == nil && $0.z+$0.data.length-distance < -config.n("despawnBehind",24)) || $0.consumed}
        if state == .running {spawn()}
    }
    private func floorValue(_ n:Double)->Double { n.rounded(.down) }
}
