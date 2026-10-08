-- Reference only. The authoritative schema is the Flyway migration set in
-- backend/src/main/resources/db/migration/, which the API applies on startup.
--
-- Do NOT run this file against the database the API uses: Flyway refuses to start when it finds a
-- non-empty schema with no history table, and the API would then fail to boot. Use it to create a
-- database by hand only when you are deliberately not using Flyway at all.

CREATE DATABASE IF NOT EXISTS weiwei_blog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE weiwei_blog;

CREATE TABLE IF NOT EXISTS blog_users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  bio VARCHAR(160) NOT NULL DEFAULT '',
  avatar_url VARCHAR(1000),
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_blog_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS diary_entries (
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
  INDEX idx_diaries_owner_date (owner_id, entry_date DESC),
  INDEX idx_diaries_public_date (visibility, entry_date DESC),
  CONSTRAINT fk_diaries_owner FOREIGN KEY (owner_id) REFERENCES blog_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS blog_articles (
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

CREATE TABLE IF NOT EXISTS media_assets (
  id BIGINT NOT NULL AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  kind VARCHAR(12) NOT NULL,
  title VARCHAR(180) NOT NULL,
  album_name VARCHAR(80) NOT NULL DEFAULT '日常',
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
