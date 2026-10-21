import AppKit
import SceneKit
import Metal
_ = NSApplication.shared
let root=CommandLine.arguments[1]
let cfg=GameConfig(data:try Data(contentsOf:URL(fileURLWithPath:root+"/shared/config/gameplay.json")))
let asset=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:root+"/shared/assets/scene.json"))) as! [String:Any]
let scene=RailScene(asset:asset,config:cfg)
let engine=GameEngine(config:cfg,save:SaveData());engine.start();engine.state = .running;engine.distance=68
engine.items=[ActiveItem(data:RouteItem(id:"preview-train",kind:"train",lane:-1,z:88,y:0,length:10),z:88,previousZ:88),ActiveItem(data:RouteItem(id:"preview-barrier",kind:"barrier",lane:0,z:98,y:0,length:0.5),z:98,previousZ:98)]
let renderer=SCNRenderer(device:MTLCreateSystemDefaultDevice(),options:nil);renderer.scene=scene.scene;renderer.pointOfView=scene.camera
for state in [RunState.running,.menu] {engine.state=state;scene.update(engine,delta:1/60);let image=renderer.snapshot(atTime:0,with:CGSize(width:390,height:844),antialiasingMode:.multisampling4X);let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!;try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:root+"/outputs/ios/preview-macos-SceneKit-"+state.rawValue+".png"))}
