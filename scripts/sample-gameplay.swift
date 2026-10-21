import Foundation
import AVFoundation
import AppKit
let asset=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[1]));let generator=AVAssetImageGenerator(asset:asset);generator.appliesPreferredTrackTransform=true
for second in [0,30,60] {let frame=try generator.copyCGImage(at:CMTime(seconds:Double(second),preferredTimescale:600),actualTime:nil);let image=NSBitmapImageRep(cgImage:frame);try image.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[2]+"/decoded-\(second).png"));print(second,frame.width,frame.height)}
