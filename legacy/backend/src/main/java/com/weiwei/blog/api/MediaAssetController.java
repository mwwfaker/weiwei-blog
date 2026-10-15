package com.weiwei.blog.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@RestController @RequestMapping("/api/media")
public class MediaAssetController {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MediaAssetController.class);

    /**
     * How long a browser-side media link stays valid. Images and audio are rendered straight from
     * these links, so this must comfortably outlast a browsing session; 10 minutes left long-open
     * pages with broken images.
     */
    private static final Duration LINK_TTL = Duration.ofHours(1);

    private final MediaAssetRepository repository;
    private final S3Presigner presigner;
    private final S3Client s3;
    private final String bucket;
    public MediaAssetController(MediaAssetRepository repository, S3Presigner presigner, S3Client s3, @Value("${app.storage.bucket}") String bucket) {
        this.repository = repository; this.presigner = presigner; this.s3 = s3; this.bucket = bucket;
    }
    @GetMapping public List<MediaView> list(@AuthenticationPrincipal Jwt user) {
        return repository.findAllByOwnerIdOrderByCreatedAtDesc(userId(user)).stream().map(asset -> view(asset, presigner, bucket)).toList();
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public MediaView create(@Valid @RequestBody MediaRequest request, @AuthenticationPrincipal Jwt user) {
        if (!"IMAGE".equals(request.kind()) && !"MUSIC".equals(request.kind()) && !"MUSIC_URL".equals(request.kind())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if ("MUSIC_URL".equals(request.kind())) {
            if (!request.objectKey().startsWith("https://")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "音乐地址必须使用 HTTPS");
        } else {
            String prefix = "users/" + user.getSubject() + "/" + ("IMAGE".equals(request.kind()) ? "images/" : "music/");
            if (!request.objectKey().startsWith(prefix)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        MediaAsset asset = new MediaAsset(); asset.setOwnerId(userId(user)); asset.setKind(request.kind());
        asset.setTitle(request.title().trim()); asset.setObjectKey(request.objectKey()); asset.setContentType(request.contentType());
        asset.setAlbumName(normalizeAlbum(request.albumName()));
        asset.setVisibility("PUBLIC".equals(request.visibility()) ? "PUBLIC" : "PRIVATE");
        return view(repository.save(asset), presigner, bucket);
    }
    @PutMapping("/{id}") public MediaView update(@PathVariable long id, @Valid @RequestBody VisibilityRequest request, @AuthenticationPrincipal Jwt user) {
        MediaAsset asset = owned(id, user); asset.setVisibility("PUBLIC".equals(request.visibility()) ? "PUBLIC" : "PRIVATE");
        if (request.title() != null && !request.title().isBlank()) asset.setTitle(request.title().trim());
        if (request.albumName() != null) asset.setAlbumName(normalizeAlbum(request.albumName()));
        return view(repository.save(asset), presigner, bucket);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        MediaAsset asset = owned(id, user);
        // Remove the row first. If the object delete then fails, the result is an unreferenced
        // object (invisible, merely wasted space) rather than a visible row pointing at no file.
        repository.delete(asset);
        if (!"MUSIC_URL".equals(asset.getKind())) {
            try {
                s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(asset.getObjectKey()).build());
            } catch (RuntimeException exception) {
                log.warn("Removed media {} from the database but could not delete object {}: {}",
                        asset.getId(), asset.getObjectKey(), exception.toString());
            }
        }
    }
    private MediaAsset owned(long id, Jwt user) {
        MediaAsset asset = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!asset.getOwnerId().equals(userId(user))) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return asset;
    }
    private Long userId(Jwt user) { return Long.valueOf(user.getSubject()); }
    private String normalizeAlbum(String album) { return album == null || album.isBlank() ? "日常" : album.trim().substring(0, Math.min(80, album.trim().length())); }

    /**
     * Builds the API view of a stored asset. A MUSIC_URL is an external HTTPS link and is returned
     * as-is; everything else lives in object storage and is handed out as a short-lived signed link.
     * The browser needs {@code createdAt} to place photos and tracks on the timeline.
     */
    private static MediaView view(MediaAsset asset, S3Presigner presigner, String bucket) {
        String url = asset.getObjectKey();
        if (!"MUSIC_URL".equals(asset.getKind())) {
            var request = GetObjectRequest.builder().bucket(bucket).key(asset.getObjectKey()).build();
            var signed = presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(LINK_TTL).getObjectRequest(request).build());
            url = signed.url().toString();
        }
        return new MediaView(asset.getId(), asset.getKind(), asset.getTitle(), asset.getObjectKey(), asset.getContentType(),
                asset.getVisibility(), url, asset.getAlbumName(), asset.getCreatedAt());
    }

    public record MediaRequest(@NotBlank String kind, @NotBlank @Size(max=180) String title, @NotBlank @Size(max=600) String objectKey,
            @NotBlank @Size(max=100) String contentType, @Size(max=12) String visibility, @Size(max=80) String albumName) {}
    public record VisibilityRequest(@NotBlank @Size(max=12) String visibility, @Size(max=180) String title, @Size(max=80) String albumName) {}
    public record MediaView(Long id, String kind, String title, String objectKey, String contentType, String visibility, String url, String albumName, Instant createdAt) {}

    @RestController @RequestMapping("/api/public/media")
    public static class PublicMediaController {
        private final MediaAssetRepository repository;
        private final S3Presigner presigner;
        private final String bucket;
        public PublicMediaController(MediaAssetRepository repository, S3Presigner presigner, @Value("${app.storage.bucket}") String bucket) {
            this.repository = repository; this.presigner = presigner; this.bucket = bucket;
        }
        @GetMapping public List<MediaView> list() {
            return repository.findAllByKindAndVisibilityOrderByCreatedAtDesc("IMAGE", "PUBLIC").stream()
                    .map(asset -> view(asset, presigner, bucket)).toList();
        }
        @GetMapping("/music") public List<MediaView> publicMusic() {
            return java.util.stream.Stream.concat(
                    repository.findAllByKindAndVisibilityOrderByCreatedAtDesc("MUSIC", "PUBLIC").stream(),
                    repository.findAllByKindAndVisibilityOrderByCreatedAtDesc("MUSIC_URL", "PUBLIC").stream())
                    .map(asset -> view(asset, presigner, bucket)).toList();
        }
    }
}
