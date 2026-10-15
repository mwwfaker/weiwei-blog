CREATE TABLE blog_articles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    visibility VARCHAR(12) NOT NULL DEFAULT 'PUBLIC',
    tags TEXT NOT NULL,
    excerpt VARCHAR(500) NOT NULL DEFAULT '',
    content LONGTEXT NOT NULL,
    cover_url VARCHAR(1000),
    article_date DATE NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_articles_owner_date (owner_id, article_date DESC),
    KEY idx_articles_public_date (visibility, article_date DESC),
    CONSTRAINT fk_articles_owner FOREIGN KEY (owner_id) REFERENCES blog_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
