import Foundation
import AVFoundation
let args=CommandLine.arguments
let video=AVURLAsset(url:URL(fileURLWithPath:args[1])),audio=AVURLAsset(url:URL(fileURLWithPath:args[2])),destination=URL(fileURLWithPath:args[3])
let composition=AVMutableComposition(),duration=video.duration
let v=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!
try v.insertTimeRange(CMTimeRange(start:.zero,duration:duration),of:video.tracks(withMediaType:.video)[0],at:.zero)
v.preferredTransform=video.tracks(withMediaType:.video)[0].preferredTransform
let a=composition.addMutableTrack(withMediaType:.audio,preferredTrackID:kCMPersistentTrackID_Invalid)!
try a.insertTimeRange(CMTimeRange(start:.zero,duration:min(duration,audio.duration)),of:audio.tracks(withMediaType:.audio)[0],at:.zero)
let parameters=AVMutableAudioMixInputParameters(track:a);parameters.setVolume(0.24,at:.zero);let mix=AVMutableAudioMix();mix.inputParameters=[parameters]
try? FileManager.default.removeItem(at:destination)
let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetHighestQuality)!
export.outputURL=destination;export.outputFileType = .mp4;export.audioMix=mix
let done=DispatchSemaphore(value:0);export.exportAsynchronously{done.signal()};done.wait()
guard export.status == .completed else {fatalError("Export failed: \(String(describing:export.error))")}
print("MP4 with original soundtrack, added in post: \(destination.path)")
