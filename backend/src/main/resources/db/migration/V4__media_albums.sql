ALTER TABLE media_assets
    ADD COLUMN album_name VARCHAR(80) NOT NULL DEFAULT '日常' AFTER title;
