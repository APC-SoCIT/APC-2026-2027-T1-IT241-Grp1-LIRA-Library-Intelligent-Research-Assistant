-- LIRA Current ERD - MySQL Workbench compatible schema snapshot
--
-- This script is adapted from the current Supabase/PostgreSQL schema so it can
-- be imported into MySQL Workbench for ERD viewing or forward engineering.
--
-- Supabase-specific features such as auth.users, RLS policies, grants,
-- PostgreSQL functions, text arrays, and pgvector indexes are represented with
-- MySQL-compatible table structures only.

CREATE DATABASE IF NOT EXISTS lira_current_erd
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lira_current_erd;

CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  full_name TEXT NOT NULL,
  first_name TEXT,
  middle_initial TEXT,
  last_name TEXT,
  suffix TEXT,
  school TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT profiles_user_fkey
    FOREIGN KEY (id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reading_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  last_read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reading_history_user_book_uq (user_id, book_id),
  KEY reading_history_user_last_read_idx (user_id, last_read_at DESC),
  CONSTRAINT reading_history_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reading_lists (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reading_lists_user_name_uq (user_id, name),
  UNIQUE KEY reading_lists_user_id_uq (user_id, id),
  CONSTRAINT reading_lists_name_length_chk CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 60),
  CONSTRAINT reading_lists_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookmarks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  list_id BIGINT NOT NULL,
  book_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY bookmarks_user_book_uq (user_id, book_id),
  KEY bookmarks_user_list_created_idx (user_id, list_id, created_at DESC),
  CONSTRAINT bookmarks_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE,
  CONSTRAINT bookmarks_user_list_fkey
    FOREIGN KEY (user_id, list_id)
    REFERENCES reading_lists (user_id, id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reservations_user_book_uq (user_id, book_id),
  KEY reservations_user_created_idx (user_id, created_at DESC),
  CONSTRAINT reservations_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_search_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  query VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY catalog_search_history_user_created_idx (user_id, created_at DESC),
  CONSTRAINT catalog_search_history_query_length_chk CHECK (CHAR_LENGTH(query) BETWEEN 1 AND 200),
  CONSTRAINT catalog_search_history_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_book_views (
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  item_type TEXT,
  genres JSON NOT NULL,
  subjects JSON NOT NULL,
  series TEXT,
  publisher TEXT,
  publication_place TEXT,
  publication_year INT,
  url TEXT,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  KEY catalog_book_views_user_viewed_idx (user_id, viewed_at DESC),
  CONSTRAINT catalog_book_views_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_embeddings (
  book_id BIGINT NOT NULL,
  searchable_text TEXT NOT NULL,
  embedding JSON NOT NULL,
  book_data JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  index_run_id CHAR(36),
  PRIMARY KEY (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
