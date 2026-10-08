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
import java.time.LocalDate;

@Entity
@Table(name = "blog_articles")
public class BlogArticle {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long ownerId;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false, length = 80) private String category;
    @Column(nullable = false, length = 12) private String visibility = "PUBLIC";
    @Column(nullable = false, columnDefinition = "TEXT") private String tags;
    @Column(nullable = false, length = 500) private String excerpt;
    @Column(nullable = false, columnDefinition = "LONGTEXT") private String content;
    @Column(length = 1000) private String coverUrl;
    @Column(nullable = false) private LocalDate articleDate;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long value) { ownerId = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getCategory() { return category; }
    public void setCategory(String value) { category = value; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String value) { visibility = value; }
    public String getTags() { return tags; }
    public void setTags(String value) { tags = value; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String value) { excerpt = value; }
    public String getContent() { return content; }
    public void setContent(String value) { content = value; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String value) { coverUrl = value; }
    public LocalDate getArticleDate() { return articleDate; }
    public void setArticleDate(LocalDate value) { articleDate = value; }
}
