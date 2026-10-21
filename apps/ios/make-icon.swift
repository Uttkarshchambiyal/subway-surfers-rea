// Original vector artwork. Regenerate from repository root with:
// xcrun swift -module-cache-path /tmp/railrush-icon-cache apps/ios/make-icon.swift
import AppKit
let directory=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("apps/ios/RailRush")
func color(_ hex:Int)->NSColor {NSColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)}
func path(_ points:[NSPoint],_ fill:NSColor) {let p=NSBezierPath();p.move(to:points[0]);for point in points.dropFirst(){p.line(to:point)};p.close();fill.setFill();p.fill()}
for (name,size) in [("Icon60@2x",120),("Icon60@3x",180),("Icon76@2x",152),("Icon83.5@2x",167)] {
    let image=NSImage(size:NSSize(width:size,height:size));image.lockFocus();let t=NSAffineTransform();t.scale(by:CGFloat(size)/180);t.concat()
    NSGradient(starting:color(0x258c99),ending:color(0x154a62))!.draw(in:NSRect(x:0,y:0,width:180,height:180),angle:90)
    color(0xf3694c).setFill();NSBezierPath(ovalIn:NSRect(x:111,y:112,width:46,height:46)).fill()
    path([NSPoint(x:23,y:0),NSPoint(x:69,y:87),NSPoint(x:77,y:87),NSPoint(x:44,y:0)],color(0xffedd1))
    path([NSPoint(x:136,y:0),NSPoint(x:103,y:87),NSPoint(x:111,y:87),NSPoint(x:157,y:0)],color(0xffedd1))
    for y in stride(from:8,through:65,by:18) {color(0xe7bd65).setFill();NSBezierPath(roundedRect:NSRect(x:40+y/4,y:y,width:100-y/2,height:6),xRadius:2,yRadius:2).fill()}
    color(0xf5d063).setFill();NSBezierPath(roundedRect:NSRect(x:55,y:46,width:70,height:87),xRadius:15,yRadius:15).fill()
    color(0x18a3ad).setFill();NSBezierPath(roundedRect:NSRect(x:60,y:50,width:60,height:77),xRadius:11,yRadius:11).fill()
    color(0x244e65).setFill();NSBezierPath(roundedRect:NSRect(x:67,y:88,width:46,height:26),xRadius:6,yRadius:6).fill()
    color(0xd0f4e6).setFill();NSBezierPath(roundedRect:NSRect(x:71,y:102,width:38,height:6),xRadius:2,yRadius:2).fill()
    for x in [69,103] {color(0xffedd1).setFill();NSBezierPath(ovalIn:NSRect(x:x,y:65,width:9,height:9)).fill()}
    color(0xffedd1).setFill();NSBezierPath(roundedRect:NSRect(x:78,y:49,width:24,height:7),xRadius:3,yRadius:3).fill()
    image.unlockFocus();let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!;try rep.representation(using:.png,properties:[:])!.write(to:directory.appendingPathComponent(name+".png"))
}
