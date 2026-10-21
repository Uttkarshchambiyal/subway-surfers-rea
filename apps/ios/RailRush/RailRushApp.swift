import SwiftUI
import SceneKit
import AVFoundation

extension Color {init(hex:String){self.init(uiColor:UIColor(hex:hex))}}

final class AudioEngine {
    var clips:[String:AVAudioPlayer]=[:], started=false
    init() {
        for name in ["coin","click","swish","stumble","power","music"] {if let u=Bundle.main.url(forResource:name,withExtension:"wav",subdirectory:"recovered/audio"),let player=try? AVAudioPlayer(contentsOf:u) {clips[name]=player;player.prepareToPlay()}}
        clips["music"]?.numberOfLoops = -1
        try? AVAudioSession.sharedInstance().setCategory(.ambient,mode:.default,options:[.mixWithOthers])
    }
    func begin() {started=true;try? AVAudioSession.sharedInstance().setActive(true)}
    func update(_ e:GameEngine) {
        for player in clips.values {player.volume=Float(e.save.muted ? 0:e.save.volume)}
        if started && (e.state == .running || e.state == .starting) && !e.save.muted {if clips["music"]?.isPlaying != true {clips["music"]?.play()}} else {clips["music"]?.pause()}
        for event in e.events {let name=event == "lane" || event == "start" ? "click":event == "shield" ? "power":event == "jump" || event == "roll" ? "swish":event == "crash" ? "stumble":event;clips[name]?.currentTime=0;clips[name]?.play()};e.events.removeAll(keepingCapacity:true)
    }
}
@MainActor final class GameModel:NSObject,ObservableObject {
    let engine:GameEngine, renderer:RailScene, audio=AudioEngine()
    @Published var revision=0
    var displayLink:CADisplayLink?,previous=0.0,lastUI=0.0
    override init() {
        func resource(_ name:String)->Data? {Bundle.main.url(forResource:name,withExtension:"json").flatMap{try? Data(contentsOf:$0)}}
        let cfg=GameConfig(data:resource("gameplay"));var route:[RouteItem]=[]
        if let data=resource("route"),let root=try? JSONSerialization.jsonObject(with:data) as? [String:Any],let values=root["entities"],let encoded=try? JSONSerialization.data(withJSONObject:values) {route=(try? JSONDecoder().decode([RouteItem].self,from:encoded)) ?? []}
        engine=GameEngine(config:cfg,route:route)
        let asset=resource("scene").flatMap{try? JSONSerialization.jsonObject(with:$0) as? [String:Any]} ?? [:]
        renderer=RailScene(asset:asset,config:cfg);super.init()
        let link=CADisplayLink(target:self,selector:#selector(frame));link.preferredFrameRateRange=CAFrameRateRange(minimum:30,maximum:60,preferred:60);link.add(to:.main,forMode:.common);displayLink=link
        NotificationCenter.default.addObserver(self,selector:#selector(interrupted),name:AVAudioSession.interruptionNotification,object:nil)
    }
    @objc func interrupted() {engine.pause();audio.update(engine);revision += 1}
    @objc func frame(_ link:CADisplayLink) {let delta=previous==0 ? 0:link.timestamp-previous;previous=link.timestamp;engine.advance(delta);renderer.update(engine,delta:delta);audio.update(engine);if link.timestamp-lastUI>1/30 {lastUI=link.timestamp;revision += 1}}
    func action(_ f:(GameEngine)->Void) {audio.begin();f(engine);revision += 1}
    func background() {engine.pause();audio.update(engine);previous=0;revision += 1}
}
final class GameView:SCNView {
    var input:((String)->Void)?
    override var canBecomeFirstResponder:Bool {true}
    override var keyCommands:[UIKeyCommand]? {[(UIKeyCommand.inputLeftArrow,"left"),("a","left"),(UIKeyCommand.inputRightArrow,"right"),("d","right"),(UIKeyCommand.inputUpArrow,"jump"),("w","jump"),(" ","jump"),(UIKeyCommand.inputDownArrow,"roll"),("s","roll"),("b","board"),(UIKeyCommand.inputEscape,"pause"),("p","pause")].map {UIKeyCommand(title:$0.1,action:#selector(key(_:)),input:$0.0,modifierFlags:[])}}
    @objc func key(_ sender:UIKeyCommand) {input?(sender.title)}
}
struct SceneSurface:UIViewRepresentable {
    let model:GameModel
    func makeUIView(context:Context)->GameView {let v=GameView();v.scene=model.renderer.scene;v.pointOfView=model.renderer.camera;v.isPlaying=true;v.rendersContinuously=true;v.preferredFramesPerSecond=60;v.antialiasingMode = .multisampling2X;v.backgroundColor=UIColor(hex:"72c6fb");v.input={context.coordinator.input($0)};let pan=UIPanGestureRecognizer(target:context.coordinator,action:#selector(Coordinator.pan(_:)));v.addGestureRecognizer(pan);let tap=UITapGestureRecognizer(target:context.coordinator,action:#selector(Coordinator.doubleTap));tap.numberOfTapsRequired=2;v.addGestureRecognizer(tap);v.becomeFirstResponder();return v}
    func updateUIView(_ uiView:GameView,context:Context){}
    func makeCoordinator()->Coordinator {Coordinator(model)}
    @MainActor final class Coordinator:NSObject {let model:GameModel;init(_ model:GameModel){self.model=model}
        func input(_ name:String){model.action{e in switch name {case "left":e.move(-1);case "right":e.move(1);case "jump":e.jump();case "roll":e.slide();case "board":e.board();case "pause":e.state == .paused ? e.resume():e.pause();default:break}}}
        @objc func pan(_ g:UIPanGestureRecognizer){guard g.state == .ended else{return};let d=g.translation(in:g.view);guard max(abs(d.x),abs(d.y))>=24 else{return};input(abs(d.x)>abs(d.y) ? (d.x<0 ? "left":"right"):(d.y<0 ? "jump":"roll"))}
        @objc func doubleTap(){input("board")}
    }
}
struct RailRushRoot:View {
    @StateObject var model=GameModel()
    @Environment(\.scenePhase) var scenePhase
    @State private var sheet=""
    let navy=Color(red:0.08,green:0.22,blue:0.31),cream=Color(red:1,green:0.96,blue:0.85),coral=Color(red:0.95,green:0.38,blue:0.28)
    var e:GameEngine {model.engine}
    var body:some View {
        ZStack {
            SceneSurface(model:model).ignoresSafeArea()
            LinearGradient(colors:[Color.black.opacity(0.2),.clear,.clear,Color.black.opacity(0.25)],startPoint:.top,endPoint:.bottom).ignoresSafeArea().allowsHitTesting(false)
            if e.state == .running || e.state == .starting || e.state == .collision {hud}
            if e.state == .menu {menu}
            if e.state == .paused {pausePanel}
            if e.state == .results {results}
            if e.state == .starting {Text("READY?").font(.system(size:44,weight:.black,design:.rounded)).foregroundStyle(cream).shadow(color:navy,radius:0,x:0,y:4).allowsHitTesting(false)}
            if e.state == .collision {coral.opacity(max(0,0.35-e.phaseTime*0.55)).ignoresSafeArea().allowsHitTesting(false)}
        }
        .font(.system(.body,design:.rounded)).preferredColorScheme(.light)
        .onChange(of:scenePhase) {_,phase in if phase != .active {model.background()}}
        .sheet(isPresented:Binding(get:{!sheet.isEmpty},set:{if !$0 {sheet=""}})) {sheetView}
    }
    func button(_ title:String,_ icon:String="",secondary:Bool=false,action:@escaping()->Void)->some View {Button(action:action){HStack(spacing:8){if !icon.isEmpty {Image(systemName:icon)};Text(title).fontWeight(.heavy)}.frame(maxWidth:.infinity).padding(.vertical,16).foregroundStyle(secondary ? navy:cream).background(secondary ? cream:coral,in:RoundedRectangle(cornerRadius:18)).overlay(RoundedRectangle(cornerRadius:18).stroke(navy.opacity(0.13),lineWidth:2))}.buttonStyle(.plain)}
    func badge(_ title:String,_ value:String)->some View {VStack(alignment:.leading,spacing:2){Text(title).font(.system(size:10,weight:.heavy)).tracking(1.2);Text(value).font(.system(size:23,weight:.black,design:.rounded)).monospacedDigit()}.foregroundStyle(cream).padding(.horizontal,14).padding(.vertical,9).background(navy.opacity(0.86),in:RoundedRectangle(cornerRadius:15))}
    var hud:some View {VStack(spacing:8) {
        HStack(alignment:.top) {
            Button {model.action{$0.pause()}} label:{Image(systemName:"pause.fill").font(.system(size:29,weight:.black)).foregroundStyle(.white).frame(width:52,height:55).background(LinearGradient(colors:[Color(hex:"79c7e2"),Color(hex:"3b87ab")],startPoint:.top,endPoint:.bottom),in:RoundedRectangle(cornerRadius:10)).overlay(RoundedRectangle(cornerRadius:10).stroke(cream,lineWidth:3)).shadow(color:navy,radius:0,x:1,y:2)}.accessibilityLabel("Pause")
            Spacer()
            VStack(alignment:.trailing,spacing:8) {
                HStack(spacing:3){Text(e.powers["multiplier",default:0]>0 ? "x2":"x1").foregroundStyle(e.powers["multiplier",default:0]>0 ? Color.green:Color.yellow);Image(systemName:"star.fill").foregroundStyle(Color(hex:"ffda29")).shadow(color:Color.orange,radius:0,x:1,y:2);Text(String(format:"%06d",e.score)).foregroundStyle(.white).monospacedDigit()}.font(.system(size:25,weight:.black,design:.rounded)).padding(.horizontal,9).padding(.vertical,5).background(.black.opacity(0.38),in:RoundedRectangle(cornerRadius:10))
                HStack(spacing:5){Text(String(e.coins)).font(.system(size:25,weight:.black,design:.rounded));Image(systemName:"circle.fill").font(.system(size:25,weight:.black)).foregroundStyle(Color.yellow).overlay(Text("$").font(.system(size:20,weight:.black)).foregroundStyle(Color.orange))}.foregroundStyle(.white).padding(.horizontal,9).padding(.vertical,3).background(.black.opacity(0.4),in:RoundedRectangle(cornerRadius:9))
            }
        }
        Spacer()
        HStack(alignment:.bottom,spacing:8) {
            VStack(alignment:.leading,spacing:8){ForEach(["magnet","jetpack","boots","multiplier","board"],id:\.self){name in if e.powers[name,default:0]>0 {powerMeter(name)}}}
            Spacer(minLength:0)
            if e.powers["board",default:0]<=0 {Button{model.action{$0.board()}}label:{VStack(spacing:2){Image(systemName:"skateboard.fill").font(.system(size:25,weight:.black));Text(String(e.save.boards)).font(.system(size:14,weight:.black))}.foregroundStyle(.white).frame(width:52,height:56).background(Color(hex:"3a639c"),in:RoundedRectangle(cornerRadius:10)).overlay(RoundedRectangle(cornerRadius:10).stroke(.white,lineWidth:3))}.accessibilityLabel("Use hoverboard, \(e.save.boards) remaining")}
        }
    }.padding(.horizontal,12).padding(.top,12).padding(.bottom,8)}
    func powerMeter(_ name:String)->some View {let duration=e.config.n(name+"Seconds",name == "board" ? 20:12);let fraction=e.powers[name,default:0]/duration
        return HStack(spacing:5){Text(["magnet":"M","jetpack":"J","boots":"↑","multiplier":"2×","board":"B"][name]!).font(.system(size:23,weight:.black,design:.rounded)).foregroundStyle(.yellow).shadow(color:.orange,radius:0,x:1,y:2).frame(width:45,height:45).background(Color(hex:"3775b5"),in:RoundedRectangle(cornerRadius:9)).overlay(RoundedRectangle(cornerRadius:9).stroke(.white,lineWidth:3));HStack(spacing:3){ForEach(0..<10){index in Rectangle().fill(Double(index)/10<fraction ? Color(hex:"edf31b"):Color(hex:"52618b")).frame(width:8,height:23)}}.padding(5).background(Color(hex:"364b7b"),in:RoundedRectangle(cornerRadius:9)).overlay(RoundedRectangle(cornerRadius:9).stroke(.white,lineWidth:3))}.accessibilityElement(children:.ignore).accessibilityLabel("\(powerName(name)), \(Int(ceil(e.powers[name,default:0]))) seconds")
    }
    func powerName(_ name:String)->String {["magnet":"MAGNET","jetpack":"JETPACK","boots":"SUPER BOOTS","multiplier":"SCORE ×2","board":"HOVERBOARD"][name] ?? name}
    var menu:some View {VStack {
        HStack {Spacer();Button{sheet="settings"}label:{Image(systemName:"gearshape.fill").font(.system(size:31,weight:.heavy)).foregroundStyle(.white).shadow(color:navy,radius:0,x:2,y:2).padding(10)}.accessibilityLabel("Settings")}.padding(.top,10)
        Spacer(minLength:20)
        Spacer()
        Button {model.action{$0.start()}} label:{Text("Tap to Play").font(.system(size:33,weight:.black,design:.rounded)).foregroundStyle(.white).shadow(color:navy,radius:0,x:-2,y:0).shadow(color:navy,radius:0,x:2,y:0).shadow(color:navy,radius:0,x:0,y:4).padding(.vertical,25).frame(maxWidth:.infinity)}.accessibilityLabel("Tap to Play")
        HStack(spacing:16){menuIcon("Shop","bag.fill"){sheet="shop"};Spacer();VStack(spacing:3){Text("BEST \(e.save.best)");Text("● \(e.save.wallet)").foregroundStyle(.yellow)}.font(.system(size:12,weight:.black)).foregroundStyle(.white).shadow(color:navy,radius:0,x:1,y:2);Spacer();menuIcon("Missions","star.fill"){sheet="missions"}}.padding(.bottom,10)
    }.padding(.horizontal,20)}
    func menuIcon(_ label:String,_ symbol:String,action:@escaping()->Void)->some View {Button(action:action){VStack(spacing:4){Image(systemName:symbol).font(.system(size:24,weight:.heavy)).foregroundStyle(.yellow).frame(width:52,height:45).background(Color(hex:"345c96"),in:RoundedRectangle(cornerRadius:9)).overlay(RoundedRectangle(cornerRadius:9).stroke(.white,lineWidth:2));Text(label).font(.system(size:11,weight:.black)).foregroundStyle(.white).shadow(color:navy,radius:0,x:1,y:2)}}}
    var pausePanel:some View {panel {Text("TAKE A BREATHER").font(.title2.weight(.black));Text("Your run is safely paused.").font(.subheadline);button("KEEP RUNNING","play.fill"){model.action{$0.resume()}};button("START AGAIN","arrow.clockwise",secondary:true){model.action{$0.start()}};button("BACK TO MENU","house",secondary:true){model.action{$0.menu()}};Button("Sound settings"){sheet="settings"}.font(.caption.weight(.bold))}}
    var results:some View {panel {Text("NICE RUN!").font(.system(size:36,weight:.black,design:.rounded));Text("The next train is always coming.").font(.subheadline);HStack{stat("SCORE",String(e.score));stat("DISTANCE","\(Int(e.distance))m");stat("COINS","+\(e.coins)")};Text("BEST \(e.save.best) · WALLET \(e.save.wallet)").font(.caption.weight(.black));button("RUN IT BACK","arrow.clockwise"){model.action{$0.start()}};button("BACK TO MENU","house",secondary:true){model.action{$0.menu()}}}}
    func stat(_ title:String,_ value:String)->some View {VStack{Text(title).font(.system(size:9,weight:.black));Text(value).font(.title3.weight(.black)).monospacedDigit()}.frame(maxWidth:.infinity).padding(.vertical,14).background(navy.opacity(0.07),in:RoundedRectangle(cornerRadius:12))}
    func panel<Content:View>(@ViewBuilder content:()->Content)->some View {ZStack{navy.opacity(0.5).ignoresSafeArea();VStack(spacing:16,content:content).foregroundStyle(navy).padding(24).frame(maxWidth:400).background(cream,in:RoundedRectangle(cornerRadius:28)).padding(24)}}
    var sheetView:some View {NavigationStack {ScrollView {VStack(alignment:.leading,spacing:18){if sheet == "shop" {Text("Only the coins you earn.").font(.subheadline);Text("WALLET  ● \(e.save.wallet)").font(.title3.weight(.black));ForEach(["coral","mint","violet"],id:\.self){id in HStack{Circle().fill(Color(uiColor:UIColor(hex:id == "coral" ? "42869d":id == "mint" ? "28bba5":"9a70d5"))).frame(width:38,height:38);VStack(alignment:.leading){Text(id == "coral" ? "Jake":id == "mint" ? "Outfit 1":"Outfit 2").fontWeight(.heavy);Text(e.save.unlocked.contains(id) ? "Owned":"\(id == "mint" ? 120:240) earned coins").font(.caption)};Spacer();Button(e.save.selectedSkin == id ? "Selected":e.save.unlocked.contains(id) ? "Wear":"Unlock"){model.action{$0.buySkin(id)}}.buttonStyle(.bordered).disabled(e.save.selectedSkin == id || (!e.save.unlocked.contains(id) && e.save.wallet < (id == "mint" ? 120:240)))}};button("3 hoverboards · 30 coins","skateboard.fill"){model.action{$0.buyBoards()}}.disabled(e.save.wallet<30);Text("\(e.save.boards) boards ready for your next run.").font(.caption)} else if sheet == "missions" {mission("coins25","Collect 25 coins",Double(e.save.totalCoins),25,40);mission("distance1000","Travel 1,000 metres",e.save.totalDistance,1000,60);mission("runs3","Finish 3 runs",Double(e.save.runs),3,30)} else {Toggle("Mute audio",isOn:Binding(get:{e.save.muted},set:{v in model.action{$0.save.muted=v;$0.save.write()}}));Text("Volume").fontWeight(.heavy);Slider(value:Binding(get:{e.save.volume},set:{v in model.action{$0.save.volume=v;$0.save.write()}}),in:0...1);Divider();Text("SWIPE LEFT / RIGHT\nChange lanes\n\nSWIPE UP\nJump — boots jump higher\n\nSWIPE DOWN\nRoll under signs / descend\n\nDOUBLE TAP OR BOARD\nUse one hoverboard\n\nKeyboard: arrows or WASD; B board; P pause.").font(.subheadline);Text("Offline reference recreation. No accounts.").font(.caption).foregroundStyle(.secondary)}}.padding(24)}.background(cream).navigationTitle(sheet.capitalized).toolbar{ToolbarItem(placement:.topBarTrailing){Button("Done"){sheet=""}}}}}
    func mission(_ id:String,_ title:String,_ progress:Double,_ target:Double,_ reward:Int)->some View {VStack(alignment:.leading,spacing:10){Text(title).font(.headline);ProgressView(value:min(progress,target),total:target).tint(coral);HStack{Text("\(Int(min(progress,target))) / \(Int(target))").font(.caption);Spacer();Button(e.save.claimed.contains(id) ? "Claimed":"Claim \(reward) coins"){model.action{$0.claim(id)}}.disabled(progress<target || e.save.claimed.contains(id))}}.padding(16).background(.white.opacity(0.6),in:RoundedRectangle(cornerRadius:16))}
}
@main struct RailRushApp:App {var body:some Scene {WindowGroup {RailRushRoot()}}}
