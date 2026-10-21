import Foundation

var results:[[String:Any]]=[]
func check(_ name:String,_ condition:Bool,_ detail:String="") {results.append(["scenario":name,"passed":condition,"detail":detail]);if !condition {fputs("FAIL: \(name) \(detail)\n",stderr)}}
func close(_ a:Double,_ b:Double)->Bool {abs(a-b)<0.00001}
let root=CommandLine.arguments.count>1 ? CommandLine.arguments[1]:FileManager.default.currentDirectoryPath
let cfg=GameConfig(data:try Data(contentsOf:URL(fileURLWithPath:root+"/shared/config/gameplay.json")))
let physics=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"/shared/test-vectors/physics.json"))) as! [String:Any]
func run(_ route:[RouteItem]=[])->GameEngine {let e=GameEngine(config:cfg,route:route,save:SaveData());e.start();for _ in 0..<96 {e.tick(cfg.dt)};e.state = .running;return e}
let e=run();for _ in 0..<1200 {e.tick(cfg.dt)}
let travel=physics["unimpeded10s"] as! [String:Double]
check("shared travel10s",close(e.distance,travel["distance"]!) && close(e.speed,travel["speed"]!) && e.score==Int(travel["score"]!),"D=\(e.distance) v=\(e.speed) score=\(e.score)")
let j=run();j.jump();var apex=0.0,ticks=0
repeat {j.tick(cfg.dt);apex=max(apex,j.y);ticks += 1} while j.y>0 && ticks<200
let jump=physics["jump"] as! [String:Double]
check("shared jump apex and landing",close(apex,jump["apex"]!) && close(Double(ticks)*cfg.dt,jump["landingSeconds"]!),"apex=\(apex) seconds=\(Double(ticks)*cfg.dt)")
let l=run();l.move(1);l.tick(cfg.n("laneChangeSeconds",0.27)/2);let mid=l.x;l.tick(cfg.n("laneChangeSeconds",0.27)/2);check("shared linear lane timing",close(mid,cfg.n("laneWidth",3.8888888889)/2) && close(l.x,cfg.n("laneWidth",3.8888888889)));l.move(-1);l.tick(0.04);let before=l.x;l.move(-1);l.tick(0);check("lane redirect continuity",close(l.x,before))
let p=run();p.activate("magnet");for _ in 0..<1200 {p.tick(cfg.dt)};check("shared power expiry",close(p.powers["magnet"]!,2));p.pause();let d=p.distance;for _ in 0..<1200 {p.advance(cfg.dt)};check("pause freezes distance and timers",p.distance==d && close(p.powers["magnet"]!,2));p.resume();check("explicit resume",p.state == .running)
let b=run();b.board();b.items=[ActiveItem(data:RouteItem(id:"barrier",kind:"barrier",lane:0,z:0.2,y:0,length:1),z:0.2,previousZ:0.2)];b.tick(cfg.dt);check("board consumes inventory protects crash",b.save.boards==2 && b.state == .running && b.powers["board"]==0 && b.grace>0)
let crash=run();crash.items=[ActiveItem(data:RouteItem(id:"barrier",kind:"barrier",lane:0,z:0.2,y:0,length:1),z:0.2,previousZ:0.2)];crash.tick(cfg.dt);check("ground barrier crashes",crash.state == .collision)
let roll=run();roll.slide();roll.items=[ActiveItem(data:RouteItem(id:"overhead",kind:"overhead",lane:0,z:0.2,y:0,length:1),z:0.2,previousZ:0.2)];roll.tick(cfg.dt);check("roll passes overhead",roll.state == .running)
let crossMagnet=run();crossMagnet.move(-1);for _ in 0..<40 {crossMagnet.tick(cfg.dt)};crossMagnet.activate("magnet");crossMagnet.items=[ActiveItem(data:RouteItem(id:"cross",kind:"coin",lane:1,z:crossMagnet.distance+5,y:0.9,length:0.5),z:crossMagnet.distance+5,previousZ:crossMagnet.distance+5)];crossMagnet.tick(cfg.dt);check("magnet attracts far opposite lane",crossMagnet.coins==0 && crossMagnet.items[0].attraction != nil);crossMagnet.pause();let flightProgress=crossMagnet.items[0].attraction!.elapsed;for _ in 0..<100 {crossMagnet.tick(cfg.dt)};check("pause freezes coin flight",crossMagnet.items[0].attraction!.elapsed==flightProgress);crossMagnet.resume();crossMagnet.powers["magnet"]=0;for _ in 0..<100 {crossMagnet.tick(cfg.dt)};check("flight survives expiry and credits once",crossMagnet.coins==1)
let magnet=run();magnet.activate("magnet");magnet.items=[ActiveItem(data:RouteItem(id:"coin",kind:"coin",lane:1,z:4,y:0.9,length:0.5),z:4,previousZ:4)];magnet.tick(cfg.dt);check("magnet launches adjacent coin before credit",magnet.coins==0 && magnet.items[0].attraction != nil);for _ in 0..<70 {magnet.tick(cfg.dt)};check("magnet collects adjacent lane on arrival",magnet.coins==1)
let jet=run();jet.activate("jetpack");jet.powers["jetpack"]=0.004;jet.y=8;jet.tick(cfg.dt);check("jetpack expiry landing grace",jet.grace>1.49 && jet.y<8)
let roof=run();roof.y=3;roof.items=[ActiveItem(data:RouteItem(id:"train",kind:"train",lane:0,z:0,y:0,length:10),z:0,previousZ:0)];roof.tick(cfg.dt);check("train roof supports runner",roof.y==3 && roof.state == .running)
let ramp=run();ramp.items=[ActiveItem(data:RouteItem(id:"ramp",kind:"ramp",lane:0,z:0,y:0,length:7),z:0,previousZ:0)];ramp.tick(cfg.dt);check("ramp floor ascends",ramp.floor>0 && ramp.y==ramp.floor)
let approach=run();approach.distance=98;approach.items=[ActiveItem(data:RouteItem(id:"ramp-approach",kind:"ramp",lane:0,z:107,y:0,length:7),z:107,previousZ:107),ActiveItem(data:RouteItem(id:"train-approach",kind:"train",lane:0,z:114,y:0,length:10),z:114,previousZ:114)]
var reachedRoof=false,approachSurvived=true
for _ in 0..<210 {approach.tick(cfg.dt);if approach.state != .running {approachSurvived=false;break};if approach.distance>114 && approach.distance<124 {reachedRoof = reachedRoof || close(approach.y,3)}}
check("canonical ramp approach reaches train roof",approachSurvived && reachedRoof,"D=\(approach.distance), feet=\(approach.y), state=\(approach.state.rawValue)")
let expiry=run();expiry.y=8;expiry.powers["jetpack"]=cfg.dt/2;expiry.tick(cfg.dt);check("jetpack exact expiry step",close(expiry.grace,1.5) && close(expiry.vy,-cfg.n("gravity",28)*cfg.dt) && close(expiry.y,8-cfg.n("gravity",28)*cfg.dt*cfg.dt));for _ in 0..<60 {expiry.tick(cfg.dt)};check("jetpack safe gravity descent",expiry.y>0 && expiry.y<8 && expiry.grace>0.99)
let boots=run();boots.activate("boots");boots.activate("magnet");boots.jump();var bootsApex=0.0;for _ in 0..<120 {boots.tick(cfg.dt);bootsApex=max(bootsApex,boots.y)};check("boots jump and concurrent magnet",bootsApex>1.9*jump["apex"]! && boots.powers["magnet",default:0]>10)
let boardExpiry=run();boardExpiry.y=2;boardExpiry.vy=3;boardExpiry.powers["board"]=0.004;boardExpiry.tick(cfg.dt);check("board expiry preserves trajectory",boardExpiry.powers["board"]==0 && close(boardExpiry.vy,3-cfg.n("gravity",28)*cfg.dt))
let flying=run();flying.activate("jetpack");flying.roll=0.5;flying.tick(cfg.dt);flying.slide();check("jetpack clears and rejects roll",flying.roll==0)
let sweptCoin=run();sweptCoin.speed=26;sweptCoin.items=[ActiveItem(data:RouteItem(id:"swept-coin",kind:"coin",lane:0,z:0.9,y:0.9,length:0.5),z:0.9,previousZ:0.9)];sweptCoin.tick(cfg.dt);check("swept high-speed coin",sweptCoin.coins==1)
let sweptPower=run();sweptPower.speed=26;sweptPower.items=[ActiveItem(data:RouteItem(id:"swept-power",kind:"magnet",lane:0,z:1.1,y:0.9,length:0.5),z:1.1,previousZ:1.1)];sweptPower.tick(cfg.dt);check("swept high-speed pickup",sweptPower.powers["magnet",default:0]>11.9)
let coin=run();coin.items=[ActiveItem(data:RouteItem(id:"coin",kind:"coin",lane:0,z:0.2,y:0.9,length:0.5),z:0.2,previousZ:0.2)];coin.tick(cfg.dt);check("coin pickup and score",coin.coins==1 && coin.score==10)
let score=run();score.distance=99.9;score.distanceScore=297;score.activate("multiplier");score.tick(cfg.dt);check("score multiplier",score.score==303)
let monotonic=run();monotonic.distance=99.9;monotonic.distanceScore=297;monotonic.powers["multiplier"]=0.02;monotonic.tick(cfg.dt);let earned=monotonic.score;for _ in 0..<10 {monotonic.tick(cfg.dt)};check("multiplier expiry never removes score",earned==303 && monotonic.score>=earned && monotonic.powers["multiplier"]==0)
let skin=run();skin.save.wallet=120;skin.buySkin("mint");skin.buySkin("mint");check("earned shop charges once",skin.save.wallet==0 && skin.save.selectedSkin=="mint" && skin.save.unlocked.count==2)
let m=run();m.save.totalCoins=25;m.claim("coins25");m.claim("coins25");check("mission claims once",m.save.wallet==40 && m.save.claimed==["coins25"])
let reset=run();reset.coins=5;reset.distance=100;reset.score=350;reset.menu();reset.menu();check("run settlement once",reset.save.wallet==5 && reset.save.runs==1);reset.start();check("restart resets complete state",reset.distance==0 && reset.items.isEmpty && reset.coins==0 && reset.powers.isEmpty && reset.state == .starting)
let routeData=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"/shared/config/route.json"))) as! [String:Any]
let route=try JSONDecoder().decode([RouteItem].self,from:JSONSerialization.data(withJSONObject:routeData["entities"]!))
let extended=run(route);var maxItems=0;for tick in 0..<120000 {extended.grace=1;extended.tick(cfg.dt);if tick%1000==0 {maxItems=max(maxItems,extended.items.count)}}
check("1000 second bounded infinite route",extended.distance>20000 && maxItems<300 && extended.items.count<300,"distance=\(extended.distance), maxActive=\(maxItems), active=\(extended.items.count)")
let gated=run();gated.move(1);gated.move(-1);check("lane input minimum travel gate",gated.lane==1);for _ in 0..<3 {gated.tick(cfg.dt)};gated.move(-1);check("lane input reopens after travel",gated.lane==0)
let jetLane=run();jetLane.activate("jetpack");jetLane.move(1);jetLane.tick(cfg.n("jetpackLaneChangeSeconds",0.54)/2);check("jetpack uses slower lane duration",close(jetLane.x,cfg.n("laneWidth",3.8888888889)/2))
let graceJump=run();graceJump.grounded=false;graceJump.groundedAgo=cfg.n("groundedJumpGraceSeconds",0.15)/2;graceJump.y=0.2;graceJump.jump();check("jump grace after leaving support",close(graceJump.vy,cfg.n("jumpVelocity",10)));graceJump.tick(cfg.dt);let firstVy=graceJump.vy;graceJump.jump();check("jump grace cannot double jump",graceJump.vy==firstVy);graceJump.slide();check("airborne dive and roll duration",close(graceJump.vy,cfg.n("diveVelocity",-17.5)) && close(graceJump.roll,cfg.n("rollSeconds",0.6)))
let noGrace=run();noGrace.grounded=false;noGrace.groundedAgo=cfg.n("groundedJumpGraceSeconds",0.15);noGrace.y=0.2;noGrace.jump();check("jump rejected after support grace",noGrace.vy==0)
let boundary=run();boundary.move(1);boundary.tick(cfg.n("laneChangeSeconds",0.27));boundary.move(1);boundary.move(-1);check("boundary swipe keeps valid reverse available",boundary.lane==0)
let reversal=run();reversal.move(1);reversal.tick(0.01);reversal.move(-1);let earlyBlocked=reversal.lane==1;reversal.tick(0.08);let reverseStart=reversal.x;reversal.move(-1);let shortReturn=reversal.laneDuration<0.1 && reversal.lane==0 && close(reversal.x,reverseStart);reversal.tick(reversal.laneDuration);check("native lateral reversal gate and proportional return",earlyBlocked && shortReturn && close(reversal.x,0))
let cycleTest=run([RouteItem(id:"cycle",kind:"coin",lane:1,z:96,y:0.9,length:0.1)]);cycleTest.distance=cfg.n("routeCycleLength",6144)-200;cycleTest.tick(cfg.dt);check("route repeats at shared cycle",cycleTest.items.contains{close($0.z,cfg.n("routeCycleLength",6144)+96)})
let report:[String:Any]=["platform":"Swift Foundation engine on macOS, no iOS runtime","passed":results.allSatisfy{$0["passed"] as? Bool == true},"results":results]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);FileHandle.standardOutput.write(data);print("")
if !results.allSatisfy({$0["passed"] as? Bool == true}) {exit(1)}

let scenario=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"/shared/test-vectors/scenarios.json"))) as! [String:Any]
let conform=GameEngine(config:cfg,route:route,save:SaveData());conform.start();conform.state = .running
let actions=scenario["actions"] as! [[String:Any]],sampleTicks=scenario["sampleTicks"] as! [Int]
var samples:[[String:Any]]=[]
for tick in 0..<(scenario["ticks"] as! Int) {
    for action in actions where action["tick"] as? Int == tick {switch action["action"] as! String {case "left":conform.move(-1);case "right":conform.move(1);case "jump":conform.jump();case "roll":conform.slide();default:conform.activate(action["action"] as! String)}}
    conform.grace=1;conform.tick(cfg.dt)
    if sampleTicks.contains(tick+1) {var sample:[String:Any]=["tick":tick+1,"distance":conform.distance,"speed":conform.speed,"x":conform.x,"y":conform.y,"coins":conform.coins,"score":conform.score];for key in ["magnet","jetpack","boots","multiplier","board"] {sample[key]=conform.powers[key,default:0]};samples.append(sample)}
}
try JSONSerialization.data(withJSONObject:["scenario":"canonical-20s","samples":samples],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:root+"/outputs/ios/conformance.json"))
