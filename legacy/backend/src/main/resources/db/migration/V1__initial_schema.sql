CREATE TABLE blog_users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(190) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_blog_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE diary_entries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    entry_date DATE NOT NULL,
    mood VARCHAR(30) NOT NULL,
    weather VARCHAR(16) NOT NULL,
    visibility VARCHAR(12) NOT NULL DEFAULT 'PRIVATE',
    tags TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_diaries_owner_date (owner_id, entry_date DESC),
    KEY idx_diaries_public_date (visibility, entry_date DESC),
    CONSTRAINT fk_diaries_owner FOREIGN KEY (owner_id) REFERENCES blog_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
