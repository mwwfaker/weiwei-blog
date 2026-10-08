CREATE TABLE media_assets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    kind VARCHAR(12) NOT NULL,
    title VARCHAR(180) NOT NULL,
    object_key VARCHAR(600) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    visibility VARCHAR(12) NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_media_object_key (object_key),
    KEY idx_media_owner_created (owner_id, created_at DESC),
    KEY idx_media_public (kind, visibility, created_at DESC),
    CONSTRAINT fk_media_owner FOREIGN KEY (owner_id) REFERENCES blog_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
