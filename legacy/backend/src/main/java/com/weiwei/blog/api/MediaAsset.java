package com.weiwei.blog.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "media_assets")
public class MediaAsset {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long ownerId;
    @Column(nullable = false, length = 12) private String kind;
    @Column(nullable = false, length = 180) private String title;
    @Column(nullable = false, length = 80) private String albumName = "日常";
    @Column(nullable = false, length = 600) private String objectKey;
    @Column(nullable = false, length = 100) private String contentType;
    @Column(nullable = false, length = 12) private String visibility = "PRIVATE";
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long value) { ownerId = value; }
    public String getKind() { return kind; }
    public void setKind(String value) { kind = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getAlbumName() { return albumName; }
    public void setAlbumName(String value) { albumName = value; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String value) { objectKey = value; }
    public String getContentType() { return contentType; }
    public void setContentType(String value) { contentType = value; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String value) { visibility = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
