import SceneKit
import UIKit

extension UIColor {
    convenience init(hex:String) {let n=UInt32(hex.replacingOccurrences(of:"#",with:""),radix:16) ?? 0;self.init(red:CGFloat((n>>16)&255)/255,green:CGFloat((n>>8)&255)/255,blue:CGFloat(n&255)/255,alpha:1)}
}

/// SceneKit uses the recovered APK meshes, atlases and baked original skin clips.
final class RailScene {
    let jet=SCNNode(),magnet=SCNNode(),magnetField=SCNNode()
    var magnetWeight=Float(0),magnetPulse=Float(0),magnetMount=SCNVector3Zero,lastCoins=0
    var coinTrails:[String:SCNNode]=[:]
    let trailMaterial=SCNMaterial()
    let scene=SCNScene(),camera=SCNNode(),player=SCNNode(),boardNode=SCNNode(),menuTrain=SCNNode()
    let config:GameConfig,manifest:[String:Any],binary:Data,base:URL
    var prefabs:[String:SCNNode]=[:],materials:[String:SCNMaterial]=[:],segments:[SCNNode]=[],entities:[String:SCNNode]=[:],pools:[String:[SCNNode]]=[:]
    var characterNodes:[SCNNode]=[],characterMeshes:[[String:Any]]=[],skinMaterials:[SCNMaterial]=[],time=0.0,clipStart=0.0,clipName="",lastSkin=""
    var unitScale:Double {manifest["unitScale"] as! Double}
    var sectionLength:Double {180*unitScale}
    func number(_ dict:[String:Any],_ key:String)->Int {(dict[key] as! NSNumber).intValue}
    func c(_ key:String,_ fallback:Double)->Double {(config.values["camera"] as? [String:Any])?[key] as? Double ?? fallback}
    init(asset:[String:Any],config:GameConfig) {
        self.config=config
        let source=Bundle.main.url(forResource:"render",withExtension:"json",subdirectory:"recovered/native") ?? URL(fileURLWithPath:FileManager.default.currentDirectoryPath+"/shared/recovered/native/render.json")
        base=source.deletingLastPathComponent()
        do {manifest=try JSONSerialization.jsonObject(with:Data(contentsOf:source)) as! [String:Any];binary=try Data(contentsOf:base.appendingPathComponent("render.bin"))}catch{fatalError("Recovered assets are missing: \(error)")}
        scene.background.contents=UIColor(hex:"72c6fb");scene.fogColor=UIColor(hex:"7db2e0");scene.fogStartDistance=428*unitScale;scene.fogEndDistance=850*unitScale
        camera.camera=SCNCamera();camera.camera!.fieldOfView=c("verticalFov",68);camera.camera!.zNear=0.1;camera.camera!.zFar=240;scene.rootNode.addChildNode(camera)
        scene.rootNode.addChildNode(player);scene.rootNode.addChildNode(menuTrain)
        let environment=manifest["environment"] as! [String:[String:Any]]
        for (name,entry) in environment {
            let root=SCNNode();root.name=name
            for b in entry["batches"] as! [[String:Any]] {
                let offset=number(b,"offset"),bytes=number(b,"bytes"),count=number(b,"vertices");let data=binary.subdata(in:offset..<offset+bytes)
                let vertices=SCNGeometrySource(data:data,semantic:.vertex,vectorCount:count,usesFloatComponents:true,componentsPerVector:3,bytesPerComponent:4,dataOffset:0,dataStride:20)
                let uv=SCNGeometrySource(data:data,semantic:.texcoord,vectorCount:count,usesFloatComponents:true,componentsPerVector:2,bytesPerComponent:4,dataOffset:12,dataStride:20)
                let element=SCNGeometryElement(data:nil,primitiveType:.triangles,primitiveCount:count/3,bytesPerIndex:0)
                let geometry=SCNGeometry(sources:[vertices,uv],elements:[element]);geometry.materials=[texture(b["texture"] as! String,blend:b["blend"] as? String ?? "opaque",tint:b["color"] as? [Double] ?? [1,1,1,1])];root.addChildNode(SCNNode(geometry:geometry))
            }
            prefabs[name]=root
        }
        for i in 0..<8 {
            let section=SCNNode();for lane in -1...1 {let track=clone("track_4");track.position.x=Float(Double(lane)*config.n("laneWidth",3.8888888889));section.addChildNode(track)}
            let level=["high","med","low","med"][i%4],variant=level == "low" ? 1:i%3+1
            for side in ["left","right"] {section.addChildNode(clone("IrelandSpring_\(level)_0\(variant)_\(side)"))};segments.append(section);scene.rootNode.addChildNode(section)
        }
        menuTrain.addChildNode(clone("IrelandSpring_Train_Start"));menuTrain.position=SCNVector3(-config.n("laneWidth",3.8888888889),0,3)
        characterMeshes=(manifest["character"] as! [String:Any])["meshes"] as! [[String:Any]]
        for _ in characterMeshes {let node=SCNNode();player.addChildNode(node);characterNodes.append(node);skinMaterials.append(texture("../character/jake_outfit0_tex.png").copy() as! SCNMaterial)}
        boardNode.addChildNode(clone("board_default"));player.addChildNode(boardNode);jet.addChildNode(clone("Jetpack_Prop"));jet.position=SCNVector3(0,0.9,0.25);jet.scale=SCNVector3(0.6,0.6,0.6);player.addChildNode(jet)
        let held=makeEntity("magnet",length:0);held.scale=SCNVector3(0.74,0.74,0.74);magnet.addChildNode(held);scene.rootNode.addChildNode(magnet)
        trailMaterial.lightingModel = .constant;trailMaterial.diffuse.contents=UIColor(hex:"ffe894");trailMaterial.emission.contents=UIColor(hex:"ffe894");trailMaterial.blendMode = .add;trailMaterial.writesToDepthBuffer=false;trailMaterial.isDoubleSided=true
        let ring=SCNTorus(ringRadius:0.49,pipeRadius:0.008);ring.materials=[trailMaterial.copy() as! SCNMaterial];magnetField.geometry=ring;magnetField.eulerAngles.x=Float.pi/2;magnetField.position.z = -0.04;magnet.addChildNode(magnetField)
    }
    func texture(_ path:String,blend:String="opaque",tint:[Double]=[1,1,1,1])->SCNMaterial {
        let key=path+blend+String(describing:tint)
        if let m=materials[key] {return m};let m=SCNMaterial();m.lightingModel = .constant;m.isDoubleSided=true;m.diffuse.contents=UIImage(contentsOfFile:base.appendingPathComponent(path).standardizedFileURL.path);m.diffuse.wrapS = .clamp;m.diffuse.wrapT = .clamp;m.transparencyMode = .aOne
        // Baked UVs use the top-left texture origin used by native bitmap uploads.

        m.multiply.contents=UIColor(red:CGFloat(tint[0]),green:CGFloat(tint[1]),blue:CGFloat(tint[2]),alpha:CGFloat(tint[3]));if blend == "add" {m.blendMode = .add;m.writesToDepthBuffer=false};materials[key]=m;return m
    }
    func clone(_ name:String)->SCNNode {guard let source=prefabs[name] else {fatalError("Missing recovered prefab \(name)")};return source.clone()}
    func makeEntity(_ kind:String,length:Double)->SCNNode {
        let name:[String:String]=["train":"IrelandSpring_Train_Static_1_Subway","movingTrain":"IrelandSpring_Train_Moving_3_Standard","barrier":"IrelandSpring_blocker_jump","overhead":"IrelandSpring_blocker_roll","ramp":"IrelandSpring_Train_Ramp","coin":"currency_coin","magnet":"powerups_coinMagnet","jetpack":"Jetpack_Prop","boots":"powerups_superSneakers","multiplier":"powerups_2xMultiplier","board":"board_default"]
        let source=name[kind]!,model=clone(source),group=SCNNode();group.name=kind;group.addChildNode(model)
        let environment=manifest["environment"] as! [String:[String:Any]],bounds=environment[source]!,low=bounds["min"] as! [Double],high=bounds["max"] as! [Double];let size=zip(high,low).map(-)
        if ["coin","magnet","jetpack","boots","multiplier","board"].contains(kind) {let scale=(kind == "coin" ? 0.74:1.05)/max(size[0],size[1]);model.scale=SCNVector3(scale,scale,scale);model.position=SCNVector3(-(high[0]+low[0])/2*scale,-(high[1]+low[1])/2*scale,-(high[2]+low[2])/2*scale)}
        else {let height=kind == "barrier" ? 1.05:kind == "overhead" ? 2.6:3;let depth=kind == "train" || kind == "movingTrain" ? 10:kind == "ramp" ? 7:kind == "overhead" ? 1.4:0.7;model.scale=SCNVector3(1,height/size[1],depth/size[2]);model.position=SCNVector3(0,-low[1]*height/size[1],-high[2]*depth/size[2])}
        return group
    }
    func sampleCharacter(_ e:GameEngine,delta:Double) {
        let menu=e.state == .menu
        let name=menu ? "Jake_Breathe":e.state == .collision || e.state == .results ? "death_lower":e.state == .starting ? "introRun":e.roll>0 ? "roll":!e.grounded && e.vy>2 ? "jump":!e.grounded ? "hangtime":"RunNormal"
        if name != clipName {clipName=name;clipStart=time}
        let clip=(((manifest["character"] as! [String:Any])["clips"] as! [String:[String:Any]])[name])!,duration=clip["duration"] as! Double,frames=number(clip,"frames");let looping=["Jake_Breathe","RunNormal","hangtime"].contains(name);let elapsed=(time-clipStart)*(name == "RunNormal" ? e.speed/config.n("initialSpeed",21.38888888889):1);let t=looping ? elapsed.truncatingRemainder(dividingBy:duration):min(elapsed,duration);let frame=t/duration*Double(frames-1),a=Int(frame),b=min(a+1,frames-1),fraction=Float(frame-Double(a))
        let posed=((manifest["character"] as! [String:Any])["clips"] as! [String:[String:Any]])[name+"__magnet"]
        let mounts=clip["magnetMount"] as! [[Double]],raised=posed?["magnetMount"] as? [[Double]] ?? mounts
        var mount=[Float](repeating:0,count:3)
        for axis in 0..<3 {let normal=Float(mounts[a][axis])*(1-fraction)+Float(mounts[b][axis])*fraction;let up=Float(raised[a][axis])*(1-fraction)+Float(raised[b][axis])*fraction;mount[axis]=normal+(up-normal)*magnetWeight}
        magnetMount=SCNVector3(mount[0],mount[1],mount[2])
        let outfit=e.save.selectedSkin == "mint" ? 1:e.save.selectedSkin == "violet" ? 2:0
        if lastSkin != e.save.selectedSkin {lastSkin=e.save.selectedSkin;for m in skinMaterials {m.diffuse.contents=UIImage(contentsOfFile:base.appendingPathComponent("../character/jake_outfit\(outfit)_tex.png").standardizedFileURL.path)}}
        for (i,m) in characterMeshes.enumerated() {
            let count=number(m,"vertices"),offset=number((clip["meshes"] as! [[String:Any]])[i],"offset");let posedOffset=posed.map{number(($0["meshes"] as! [[String:Any]])[i],"offset")/4};var positions=[Float](repeating:0,count:count*3)
            binary.withUnsafeBytes {raw in let pointer=raw.bindMemory(to:Float.self);for v in positions.indices {let va=pointer[offset/4+a*count*3+v],vb=pointer[offset/4+b*count*3+v];positions[v]=va+(vb-va)*fraction
                if let po=posedOffset,magnetWeight>0 {let pa=pointer[po+a*count*3+v],pb=pointer[po+b*count*3+v];positions[v]+=(pa+(pb-pa)*fraction-positions[v])*magnetWeight}}}
            let data=positions.withUnsafeBufferPointer{Data(buffer:$0)};let vertex=SCNGeometrySource(data:data,semantic:.vertex,vectorCount:count,usesFloatComponents:true,componentsPerVector:3,bytesPerComponent:4,dataOffset:0,dataStride:12)
            let uv=m["uv"] as! [String:Any],uvOffset=number(uv,"offset"),uvBytes=number(uv,"bytes");let tex=SCNGeometrySource(data:binary.subdata(in:uvOffset..<uvOffset+uvBytes),semantic:.texcoord,vectorCount:count,usesFloatComponents:true,componentsPerVector:2,bytesPerComponent:4,dataOffset:0,dataStride:8)
            let index=m["indices"] as! [String:Any],indexOffset=number(index,"offset"),indexBytes=number(index,"bytes");let element=SCNGeometryElement(data:binary.subdata(in:indexOffset..<indexOffset+indexBytes),primitiveType:.triangles,primitiveCount:number(m,"indexCount")/3,bytesPerIndex:2);let geometry=SCNGeometry(sources:[vertex,tex],elements:[element]);geometry.materials=[skinMaterials[i]];characterNodes[i].geometry=geometry
        }
    }
    func flightPoint(_ flight:CoinFlight,elapsed:Double,target:SCNVector3)->SCNVector3 {
        let t=min(1,max(0,elapsed/flight.duration)),u=t*t*(3-2*t),arc=sin(Double.pi*u),side=flight.x-Double(target.x)
        return SCNVector3(flight.x+(Double(target.x)-flight.x)*u+arc*(side<0 ? -1:side>0 ? 1:0)*0.22,flight.y+(Double(target.y)-flight.y)*u+arc*0.85,flight.z+(Double(target.z)-flight.z)*u)
    }
    func update(_ e:GameEngine,delta:Double) {
        let menu=e.state == .menu,animating=[RunState.running,.collision].contains(e.state)
        let holding = !menu && e.state != .starting && (e.powers["magnet",default:0]>0 || e.items.contains{!$0.consumed && $0.attraction != nil})
        if menu || e.state == .starting {magnetWeight=0} else if animating {magnetWeight=min(1,max(0,magnetWeight+(holding ? 1:-1)*Float(min(delta,0.05))*5))}
        if e.coins>lastCoins && magnetWeight>0 {magnetPulse=1};lastCoins=e.coins
        if animating {magnetPulse=max(0,magnetPulse-Float(min(delta,0.05))*4)}
        if menu || [.running,.starting,.collision].contains(e.state) {time+=min(delta,0.05)}
        for (i,node) in segments.enumerated() {node.position.z=Float((e.distance+Double(i)*sectionLength).truncatingRemainder(dividingBy:8*sectionLength)-7*sectionLength)}
        player.position=SCNVector3(e.x+(menu ? 0.75:0),e.y,0);player.eulerAngles.y=menu ? Float(Double.pi-0.4):0;sampleCharacter(e,delta:delta);boardNode.isHidden=menu || e.powers["board",default:0]<=0;menuTrain.isHidden = !menu;jet.isHidden=menu || e.powers["jetpack",default:0]<=0
        let lift=e.y*((e.powers["jetpack",default:0]>0 || e.y>3) ? c("jetpackVerticalFollow",0.82):c("jumpVerticalFollow",0.12));camera.position=SCNVector3(e.x*c("lateralPositionFollow",0.75),c("y",6.2)+lift,c("z",7.45));camera.look(at:SCNVector3(e.x*c("lateralTargetFollow",0.55),c("lookY",0.41)+lift,c("lookZ",-14)))
        if menu {camera.position=SCNVector3(4.8,3.5,5.8);camera.look(at:SCNVector3(-0.7,2.1,0))}
        let live=Set(e.items.filter{!$0.consumed}.map{$0.data.id});for (id,node) in entities where !live.contains(id) {node.removeFromParentNode();pools[node.name ?? "coin",default:[]].append(node);entities.removeValue(forKey:id)}
        magnet.isHidden=magnetWeight<=0.01;magnet.position=SCNVector3(Float(e.x)+magnetMount.x,Float(e.y)+magnetMount.y,magnetMount.z);magnet.eulerAngles=SCNVector3(0,-0.12,sin(time*5)*0.035)
        let ringScale=1+Float(sin(time*7))*0.08+magnetPulse*0.32;magnetField.scale=SCNVector3(ringScale,ringScale,ringScale);magnetField.opacity=CGFloat(0.15+magnetPulse*0.6)
        let target=SCNVector3(magnet.position.x,magnet.position.y+0.23,magnet.position.z)
        let flying=Set(e.items.filter{!$0.consumed && $0.attraction != nil}.map{$0.data.id})
        for (id,node) in coinTrails where !flying.contains(id) {node.removeFromParentNode();coinTrails.removeValue(forKey:id)}
        for item in e.items where !item.consumed {let a=item.data;let node:SCNNode;if let existing=entities[a.id] {node=existing} else {if var pool=pools[a.kind],let reused=pool.popLast() {node=reused;pools[a.kind]=pool}else{node=makeEntity(a.kind,length:a.length)};entities[a.id]=node;scene.rootNode.addChildNode(node)};node.scale=SCNVector3(1,1,1);node.eulerAngles.z=0
            if let flight=item.attraction {
                node.position=flightPoint(flight,elapsed:flight.elapsed,target:target);let u=min(1,flight.elapsed/flight.duration),size=Float(1-0.72*pow(u,8));node.scale=SCNVector3(size,size,size)
                let trail=coinTrails[a.id] ?? SCNNode();if trail.parent == nil {scene.rootNode.addChildNode(trail);coinTrails[a.id]=trail}
                let points=(0...8).map{flightPoint(flight,elapsed:max(0,flight.elapsed-Double($0)*0.012),target:target)}
                var ribbon:[SCNVector3]=[]
                for (i,p) in points.enumerated() {let other=points[i==8 ? i-1:i+1],dx=p.x-other.x,dy=p.y-other.y,dz=p.z-other.z,px=dy-dz*0.5,py = -dx,pz=dx*0.5,factor=Float(0.04)*(1-Float(i)/9)/max(0.0001,sqrt(px*px+py*py+pz*pz));ribbon.append(SCNVector3(p.x+px*factor,p.y+py*factor,p.z+pz*factor));ribbon.append(SCNVector3(p.x-px*factor,p.y-py*factor,p.z-pz*factor))}
                let indices=(0..<8).flatMap{i->[Int32] in let k=Int32(i*2);return [k,k+1,k+2,k+1,k+3,k+2]};let geometry=SCNGeometry(sources:[SCNGeometrySource(vertices:ribbon)],elements:[SCNGeometryElement(indices:indices,primitiveType:.triangles)]);geometry.materials=[trailMaterial];trail.geometry=geometry;trail.opacity=CGFloat(min(1,flight.elapsed*12)*0.65);node.eulerAngles.y=Float(time*18)
            } else {node.position=SCNVector3(Double(a.lane)*config.n("laneWidth",3.8888888889),a.y,e.distance-item.z)};if ["coin","magnet","jetpack","boots","multiplier","board"].contains(a.kind) {node.eulerAngles.y=Float(time*(item.attraction == nil ? 2:18))}}
    }
}
