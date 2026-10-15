package com.weiwei.blog.api;

import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@RestController
@RequestMapping("/api/storage")
public class StorageController {
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif",
            "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm", "audio/flac", "audio/x-flac");
    private final S3Presigner presigner;
    private final String bucket;

    public StorageController(S3Presigner presigner, @Value("${app.storage.bucket}") String bucket) {
        this.presigner = presigner;
        this.bucket = bucket;
    }

    @PostMapping("/presign-upload")
    public UploadTarget createUploadTarget(@AuthenticationPrincipal Jwt user, @RequestBody UploadRequest request) {
        String contentType = request.contentType() == null ? "" : request.contentType().toLowerCase(Locale.ROOT).trim();
        if (!ALLOWED_TYPES.contains(contentType)) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        if (request.size() <= 0 || request.size() > 30L * 1024 * 1024) {
            // 413: Spring Framework 7 renamed PAYLOAD_TOO_LARGE to CONTENT_TOO_LARGE (RFC 9110).
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "Uploads are limited to 30 MB");
        }
        String extension = switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            case "audio/mpeg" -> "mp3";
            case "audio/mp4" -> "m4a";
            case "audio/aac" -> "aac";
            case "audio/ogg" -> "ogg";
            case "audio/webm" -> "webm";
            case "audio/flac", "audio/x-flac" -> "flac";
            default -> "wav";
        };
        String mediaType = contentType.startsWith("image/") ? "images" : "music";
        String key = "users/" + user.getSubject() + "/" + mediaType + "/" + UUID.randomUUID() + "." + extension;
        PutObjectRequest object = PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build();
        var signed = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10)).putObjectRequest(object).build());
        return new UploadTarget(key, signed.url().toString(), contentType, 600);
    }

    @PostMapping("/presign-download")
    public DownloadTarget createDownloadTarget(@AuthenticationPrincipal Jwt user, @RequestBody DownloadRequest request) {
        String prefix = "users/" + user.getSubject() + "/";
        if (request.key() == null || !request.key().startsWith(prefix)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        GetObjectRequest object = GetObjectRequest.builder().bucket(bucket).key(request.key()).build();
        var signed = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10)).getObjectRequest(object).build());
        return new DownloadTarget(signed.url().toString(), 600);
    }

    public record UploadRequest(String contentType, long size) {}
    public record DownloadRequest(String key) {}
    public record UploadTarget(String key, String uploadUrl, String contentType, long expiresIn) {}
    public record DownloadTarget(String url, long expiresIn) {}
}
