-- LIRA Full ERD - MySQL Workbench compatible schema with APC Microsoft SSO
--
-- This script is adapted from the full Supabase/PostgreSQL target schema so it
-- can be imported into MySQL Workbench for ERD viewing or forward engineering.
--
-- Microsoft Entra ID remains the identity provider. Koha bibliographic, item,
-- and circulation records remain external and are referenced by book_id /
-- biblio_id and item_id rather than copied here.
--
-- Supabase/PostgreSQL-only features such as schemas, extensions, RLS policies,
-- grants, PostgreSQL functions, text arrays, and pgvector indexes are
-- represented with MySQL-compatible table structures only.

CREATE DATABASE IF NOT EXISTS lira_full_erd
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lira_full_erd;

CREATE TABLE IF NOT EXISTS microsoft_accounts (
  object_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name TEXT,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (object_id),
  UNIQUE KEY microsoft_accounts_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  microsoft_object_id CHAR(36) NOT NULL,
  full_name TEXT NOT NULL,
  first_name TEXT,
  middle_initial TEXT,
  last_name TEXT,
  suffix TEXT,
  school TEXT,
  role ENUM('student', 'librarian', 'administrator') NOT NULL DEFAULT 'student',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY profiles_microsoft_object_uq (microsoft_object_id),
  CONSTRAINT profiles_microsoft_account_fkey
    FOREIGN KEY (microsoft_object_id)
    REFERENCES microsoft_accounts (object_id)
    ON DELETE RESTRICT
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
    REFERENCES profiles (id)
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
    REFERENCES profiles (id)
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
    REFERENCES profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT bookmarks_user_list_fkey
    FOREIGN KEY (user_id, list_id)
    REFERENCES reading_lists (user_id, id)
    ON DELETE RESTRICT
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
    REFERENCES profiles (id)
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
    REFERENCES profiles (id)
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
    REFERENCES profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  item_id BIGINT,
  koha_loan_id BIGINT,
  status ENUM('reserved', 'checked_out', 'returned', 'overdue', 'cancelled') NOT NULL DEFAULT 'checked_out',
  checked_out_at DATETIME,
  due_date DATE,
  returned_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY loan_transactions_user_status_idx (user_id, status, due_date),
  CONSTRAINT loan_transactions_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS overdue_alerts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  loan_id BIGINT NOT NULL,
  alert_status ENUM('pending', 'sent', 'failed', 'dismissed') NOT NULL DEFAULT 'pending',
  sent_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT overdue_alerts_loan_fkey
    FOREIGN KEY (loan_id)
    REFERENCES loan_transactions (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chatbot_configs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  version INT NOT NULL,
  tone VARCHAR(100) NOT NULL DEFAULT 'helpful',
  rules JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY chatbot_configs_version_uq (version),
  KEY chatbot_configs_created_by_idx (created_by),
  CONSTRAINT chatbot_configs_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title TEXT NOT NULL,
  source_type ENUM('faq', 'policy', 'catalog', 'document', 'url') NOT NULL,
  source_uri TEXT,
  status ENUM('draft', 'active', 'archived', 'failed') NOT NULL DEFAULT 'draft',
  created_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY knowledge_sources_created_by_idx (created_by),
  CONSTRAINT knowledge_sources_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_order INT NOT NULL DEFAULT 0,
  embedding JSON,
  metadata JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY knowledge_chunks_source_idx (source_id, chunk_order),
  CONSTRAINT knowledge_chunks_source_fkey
    FOREIGN KEY (source_id)
    REFERENCES knowledge_sources (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  config_id BIGINT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  PRIMARY KEY (id),
  KEY chat_sessions_user_created_idx (user_id, created_at DESC),
  KEY chat_sessions_config_idx (config_id),
  CONSTRAINT chat_sessions_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT chat_sessions_config_fkey
    FOREIGN KEY (config_id)
    REFERENCES chatbot_configs (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  message_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY chat_messages_session_created_idx (session_id, created_at),
  CONSTRAINT chat_messages_session_fkey
    FOREIGN KEY (session_id)
    REFERENCES chat_sessions (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_response_sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  chunk_id BIGINT,
  book_id BIGINT,
  source_label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY chat_response_sources_message_idx (message_id),
  KEY chat_response_sources_chunk_idx (chunk_id),
  CONSTRAINT chat_response_sources_message_fkey
    FOREIGN KEY (message_id)
    REFERENCES chat_messages (id)
    ON DELETE CASCADE,
  CONSTRAINT chat_response_sources_chunk_fkey
    FOREIGN KEY (chunk_id)
    REFERENCES knowledge_chunks (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS summary_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  length ENUM('short', 'medium', 'long') NOT NULL DEFAULT 'medium',
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY summary_requests_user_idx (user_id),
  CONSTRAINT summary_requests_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS summaries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  summary_text TEXT NOT NULL,
  source_context JSON NOT NULL,
  model_name TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY summaries_request_uq (request_id),
  CONSTRAINT summaries_request_fkey
    FOREIGN KEY (request_id)
    REFERENCES summary_requests (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citation_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  book_id BIGINT NOT NULL,
  style ENUM('apa', 'mla') NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY citation_requests_user_idx (user_id),
  CONSTRAINT citation_requests_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  citation_text TEXT NOT NULL,
  missing_fields JSON NOT NULL,
  source_metadata JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY citations_request_uq (request_id),
  CONSTRAINT citations_request_fkey
    FOREIGN KEY (request_id)
    REFERENCES citation_requests (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recommendation_runs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  strategy VARCHAR(100) NOT NULL DEFAULT 'hybrid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY recommendation_runs_user_idx (user_id),
  CONSTRAINT recommendation_runs_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recommendation_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  book_id BIGINT NOT NULL,
  item_rank INT NOT NULL,
  reason TEXT,
  score DECIMAL(10,4),
  PRIMARY KEY (id),
  UNIQUE KEY recommendation_items_run_book_uq (run_id, book_id),
  CONSTRAINT recommendation_items_run_fkey
    FOREIGN KEY (run_id)
    REFERENCES recommendation_runs (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  staff_user_id CHAR(36) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  date_from DATE,
  date_to DATE,
  filters JSON NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY report_requests_staff_user_idx (staff_user_id),
  CONSTRAINT report_requests_staff_user_fkey
    FOREIGN KEY (staff_user_id)
    REFERENCES profiles (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_exports (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  file_type ENUM('pdf', 'csv') NOT NULL,
  export_url TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY report_exports_request_idx (request_id),
  CONSTRAINT report_exports_request_fkey
    FOREIGN KEY (request_id)
    REFERENCES report_requests (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY audit_events_user_idx (user_id),
  KEY audit_events_created_idx (created_at DESC),
  CONSTRAINT audit_events_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
