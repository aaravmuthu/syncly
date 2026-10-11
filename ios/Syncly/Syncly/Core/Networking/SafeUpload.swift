import Foundation
import ImageIO
import UniformTypeIdentifiers

nonisolated enum SafeUpload {
    static func imageType(_ bytes: Data) -> (String,String)? {
        let b = [UInt8](bytes.prefix(16))
        func starts(_ sig: [UInt8],at: Int = 0) -> Bool { b.count >= at+sig.count && Array(b[at..<at+sig.count]) == sig }
        if starts([137,80,78,71,13,10,26,10]) { return ("image/png","png") }
        if starts([255,216,255]) { return ("image/jpeg","jpg") }
        if starts(Array("GIF87a".utf8)) || starts(Array("GIF89a".utf8)) { return ("image/gif","gif") }
        if starts(Array("RIFF".utf8)),starts(Array("WEBP".utf8),at:8) { return ("image/webp","webp") }
        return nil
    }
    static func image(_ data: Data) throws -> (String,String) {
        guard data.count <= 5*1024*1024 else { throw ServiceFailure(message:"Image must be under 5 MB.") }
        guard let (mime,ext) = imageType(data) else { throw ServiceFailure(message:"Use a PNG, JPG, GIF or WebP image.") }
        var out = data
        if ext == "png" || ext == "jpg" {
            guard let source = CGImageSourceCreateWithData(data as CFData,nil),let image = CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:2048] as CFDictionary) else { throw ServiceFailure(message:"That file isn’t a valid image.") }
            let encoded = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(encoded, (ext == "png" ? UTType.png.identifier : UTType.jpeg.identifier) as CFString,1,nil) else { throw ServiceFailure(message:"Could not prepare this image.") }
            // Encode fresh pixels only: do not copy source EXIF/GPS properties.
            CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality:0.88] as CFDictionary)
            guard CGImageDestinationFinalize(destination) else { throw ServiceFailure(message:"Could not prepare this image.") }
            out = encoded as Data
        }
        guard out.count <= 5*1024*1024 else { throw ServiceFailure(message:"Image must be under 5 MB.") }
        return ("data:\(mime);base64,\(out.base64EncodedString())",ext)
    }
    static func audio(_ data: Data) throws -> String {
        guard data.count <= 8*1024*1024 else { throw ServiceFailure(message:"Voice note must be under 8 MB.") }
        let bytes = [UInt8](data.prefix(16))
        let webm = bytes.starts(with:[26,69,223,163])
        let mp4 = bytes.count >= 8 && Array(bytes[4..<8]) == Array("ftyp".utf8)
        guard webm || mp4 else { throw ServiceFailure(message:"Use a WebM or MP4 voice note.") }
        return "data:\(webm ? "audio/webm" : "audio/mp4");base64,\(data.base64EncodedString())"
    }
}
