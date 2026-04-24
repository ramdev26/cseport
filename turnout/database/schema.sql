-- TurnOut MVP schema (MySQL 8+)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payout_history;
DROP TABLE IF EXISTS waitlist;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS ticket_tiers;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS organizer_profiles;
DROP TABLE IF EXISTS platform_settings;
DROP TABLE IF EXISTS profiles;

CREATE TABLE profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('attendee','organizer','admin') NOT NULL DEFAULT 'attendee',
  avatar_url VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_profiles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organizer_profiles (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  org_name VARCHAR(255) NOT NULL,
  org_slug VARCHAR(120) NULL,
  bio TEXT NULL,
  website VARCHAR(512) NULL,
  custom_domain VARCHAR(255) NULL,
  bank_name VARCHAR(120) NULL,
  bank_branch VARCHAR(120) NULL,
  bank_account_name VARCHAR(255) NULL,
  bank_account_number VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_org_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE platform_settings (
  id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  platform_fee_bps INT NOT NULL DEFAULT 500,
  currency CHAR(3) NOT NULL DEFAULT 'LKR',
  payhere_merchant_id VARCHAR(64) NULL,
  payhere_merchant_secret VARCHAR(255) NULL,
  payhere_sandbox TINYINT(1) NOT NULL DEFAULT 1,
  smtp_host VARCHAR(255) NULL,
  smtp_port INT NULL,
  smtp_user VARCHAR(255) NULL,
  smtp_pass VARCHAR(255) NULL,
  smtp_from_email VARCHAR(255) NULL,
  smtp_from_name VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (id, platform_fee_bps, currency) VALUES (1, 500, 'LKR');

CREATE TABLE events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  organizer_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description TEXT NULL,
  venue VARCHAR(255) NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  status ENUM('draft','published','cancelled') NOT NULL DEFAULT 'draft',
  page_schema JSON NOT NULL,
  cover_image_url VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_events_organizer (organizer_id),
  INDEX idx_events_status (status),
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_tiers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(512) NULL,
  price_lkr INT UNSIGNED NOT NULL DEFAULT 0,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  sold INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tiers_event (event_id),
  CONSTRAINT fk_tiers_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE registrations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  ticket_tier_id CHAR(36) NOT NULL,
  payhere_payment_id VARCHAR(64) NULL,
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  amount_lkr INT UNSIGNED NOT NULL DEFAULT 0,
  qr_payload VARCHAR(512) NULL,
  attendee_name VARCHAR(255) NULL,
  attendee_email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reg_event (event_id),
  INDEX idx_reg_user (user_id),
  INDEX idx_reg_payhere (payhere_payment_id),
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_reg_tier FOREIGN KEY (ticket_tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_user_event (event_id, user_id),
  CONSTRAINT fk_rev_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE waitlist (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_waitlist (event_id, email),
  CONSTRAINT fk_wait_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payout_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  organizer_id CHAR(36) NOT NULL,
  amount_lkr INT UNSIGNED NOT NULL,
  reference VARCHAR(120) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payout_org FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
