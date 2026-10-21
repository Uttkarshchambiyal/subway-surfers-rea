import Foundation
import AVFoundation
import AppKit
let args=CommandLine.arguments
let dir=URL(fileURLWithPath:args[1]),dest=URL(fileURLWithPath:args[2])
let frames=try FileManager.default.contentsOfDirectory(at:dir,includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.path<$1.path}
guard let first=frames.first,let image=NSImage(contentsOf:first),let cg=image.cgImage(forProposedRect:nil,context:nil,hints:nil) else {fatalError("No frames")}
let width=cg.width,height=cg.height,fps=Int32(args.count>3 ? args[3]:"25")!
if FileManager.default.fileExists(atPath:dest.path) {try FileManager.default.removeItem(at:dest)}
let writer=try AVAssetWriter(outputURL:dest,fileType:.mp4)
let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:width,AVVideoHeightKey:height,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:3_000_000]])
let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:width,kCVPixelBufferHeightKey as String:height,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
writer.add(input);guard writer.startWriting() else{fatalError(String(describing:writer.error))};writer.startSession(atSourceTime:.zero)
for (i,file) in frames.enumerated(){while !input.isReadyForMoreMediaData{Thread.sleep(forTimeInterval:0.002)};try autoreleasepool{guard let img=NSImage(contentsOf:file)?.cgImage(forProposedRect:nil,context:nil,hints:nil) else{throw NSError(domain:"frame",code:i)}
var optional:CVPixelBuffer?;CVPixelBufferCreate(kCFAllocatorDefault,width,height,kCVPixelFormatType_32ARGB,nil,&optional);let pixel=optional!;CVPixelBufferLockBaseAddress(pixel,[]);let context=CGContext(data:CVPixelBufferGetBaseAddress(pixel),width:width,height:height,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(pixel),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!;context.draw(img,in:CGRect(x:0,y:0,width:width,height:height));CVPixelBufferUnlockBaseAddress(pixel,[]);guard adaptor.append(pixel,withPresentationTime:CMTime(value:Int64(i),timescale:fps)) else{throw writer.error ?? NSError(domain:"writer",code:i)}}}
input.markAsFinished();let sem=DispatchSemaphore(value:0);writer.finishWriting{sem.signal()};sem.wait();guard writer.status == .completed else{fatalError(String(describing:writer.error))};print("Encoded \(frames.count) frames \(width)x\(height) @\(fps)fps -> \(dest.path)")
