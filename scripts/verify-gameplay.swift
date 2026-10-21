import Foundation
import AVFoundation
let source=URL(fileURLWithPath:CommandLine.arguments[1]),asset=AVURLAsset(url:source)
var report:[String:Any]=["file":source.path,"duration":CMTimeGetSeconds(asset.duration),"audioTracks":asset.tracks(withMediaType:.audio).count,"audioBoundary":"Original APK soundtrack added during export; not captured live gameplay effects or acoustic testing."]
if let track=asset.tracks(withMediaType:.video).first {
 report["width"]=track.naturalSize.width;report["height"]=track.naturalSize.height;report["fps"]=track.nominalFrameRate
 if let description=track.formatDescriptions.first {report["codec"]=String(format:"%08x",CMFormatDescriptionGetMediaSubType(description as! CMFormatDescription))}
 let reader=try AVAssetReader(asset:asset);let output=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA]);reader.add(output);guard reader.startReading() else {fatalError(String(describing:reader.error))};var frames=0,last=CMTime.invalid,monotonic=true
 while let sample=output.copyNextSampleBuffer(){let time=CMSampleBufferGetPresentationTimeStamp(sample);if last.isValid && CMTimeCompare(time,last)<=0 {monotonic=false};last=time;frames+=1}
 report["frames"]=frames;report["monotonic"]=monotonic;report["videoDecodePassed"]=reader.status == .completed && monotonic && frames>0;report["videoError"]=reader.error.map{$0.localizedDescription as Any} ?? NSNull()
}
if let track=asset.tracks(withMediaType:.audio).first {let reader=try AVAssetReader(asset:asset);let output=AVAssetReaderTrackOutput(track:track,outputSettings:[AVFormatIDKey:kAudioFormatLinearPCM]);reader.add(output);guard reader.startReading() else {fatalError(String(describing:reader.error))};var samples=0;while let buffer=output.copyNextSampleBuffer(){samples+=CMSampleBufferGetNumSamples(buffer)};report["audioSamples"]=samples;report["audioDecodePassed"]=reader.status == .completed && samples>0}
let json=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try json.write(to:URL(fileURLWithPath:CommandLine.arguments[2]));print(String(data:json,encoding:.utf8)!)
