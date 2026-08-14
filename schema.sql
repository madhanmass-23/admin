-- ==============================================================================
-- CA BUDDY ENTERPRISE AUDIT SYSTEM - UNIVERSAL MYSQL DATABASE SCHEMA
-- Compatible with ServerByte (serverbyte.in), cPanel & Standard MySQL
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+05:30';

-- ==============================================================================
-- 1. TABLE: `users` (Auditor & Administrator Directory)
-- ==============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `full_name` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `password` VARCHAR(255) NULL,
  `password_hash` VARCHAR(255) NULL,
  `role` ENUM('SUPER_ADMIN', 'MANAGER', 'USER') NOT NULL DEFAULT 'USER',
  `role_title` VARCHAR(100) NOT NULL DEFAULT 'Field Auditor',
  `unit` VARCHAR(255) NOT NULL DEFAULT 'Procurement [Marketing Department]',
  `student_reg_no` VARCHAR(100) NULL,
  `registration_no` VARCHAR(100) NULL,
  `phone` VARCHAR(32) NULL,
  `sub_unit` VARCHAR(255) NULL,
  `joined_date` DATE NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `managed_by` VARCHAR(64) NULL,
  `created_by` VARCHAR(64) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_user_id` (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_unit` (`unit`),
  INDEX `idx_users_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 2. TABLE: `audit_units` (The 8 Official TTD Units)
-- ==============================================================================
DROP TABLE IF EXISTS `audit_units`;
CREATE TABLE `audit_units` (
  `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_audit_units_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 3. TABLE: `user_sessions` (Anti-Tamper & GPS Location Ledger)
-- ==============================================================================
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(64) NOT NULL,
  `login_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `logout_at` DATETIME(6) NULL,
  `login_lat` DECIMAL(10,7) NULL,
  `login_lng` DECIMAL(10,7) NULL,
  `login_accuracy_m` DECIMAL(10,2) NULL,
  `logout_lat` DECIMAL(10,7) NULL,
  `logout_lng` DECIMAL(10,7) NULL,
  `logout_accuracy_m` DECIMAL(10,2) NULL,
  `status` ENUM('ACTIVE', 'CLOSED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `token_jti` VARCHAR(128) NULL,
  `user_agent` VARCHAR(512) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token_jti` (`token_jti`),
  INDEX `idx_user_sessions_user` (`user_id`),
  INDEX `idx_user_sessions_status` (`status`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 4. TABLE: `attendance` (Shift Attendance & Daily Handover Ledger)
-- ==============================================================================
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NULL,
  `manager_id` VARCHAR(64) NULL,
  `role_title` VARCHAR(100) NOT NULL,
  `unit` VARCHAR(255) NOT NULL,
  `sub_unit_details` VARCHAR(255) NULL,
  `audit_work_type` VARCHAR(255) NULL,
  `detailed_description` TEXT NULL,
  `key_escalations` TEXT NULL,
  `login_at` DATETIME(6) NOT NULL,
  `logout_at` DATETIME(6) NULL,
  `duration_minutes` INT UNSIGNED NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `server_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `manager_remarks` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_att_user` (`user_id`),
  INDEX `idx_att_active` (`is_active`),
  INDEX `idx_att_unit` (`unit`),
  INDEX `idx_att_login` (`login_at`),
  CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attendance_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 5. TABLE: `daily_duties` (Daily Shift Duty Directives)
-- ==============================================================================
DROP TABLE IF EXISTS `daily_duties`;
CREATE TABLE `daily_duties` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` BIGINT UNSIGNED NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `primary_unit_id` SMALLINT UNSIGNED NOT NULL,
  `sub_unit` VARCHAR(255) NULL,
  `audit_cycle` ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY') NOT NULL DEFAULT 'MONTHLY',
  `objective` TEXT NOT NULL,
  `planned_activity` TEXT NOT NULL,
  `poc_name` VARCHAR(191) NOT NULL,
  `management_note` TEXT NULL,
  `additional_assignment` TEXT NULL,
  `completion_status` ENUM('COMPLETED', 'PARTIALLY_COMPLETED', 'NOT_COMPLETED') NULL,
  `completion_notes` TEXT NULL,
  `escalations` TEXT NULL,
  `work_notes` TEXT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `closed_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_daily_duties_user` (`user_id`),
  INDEX `idx_daily_duties_unit` (`primary_unit_id`),
  INDEX `idx_daily_duties_status` (`status`),
  CONSTRAINT `fk_daily_duties_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_daily_duties_unit` FOREIGN KEY (`primary_unit_id`) REFERENCES `audit_units` (`id`),
  CONSTRAINT `fk_daily_duties_session` FOREIGN KEY (`session_id`) REFERENCES `user_sessions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 6. TABLE: `audit_process_areas`
-- ==============================================================================
DROP TABLE IF EXISTS `audit_process_areas`;
CREATE TABLE `audit_process_areas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_id` SMALLINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_process_unit` (`unit_id`),
  CONSTRAINT `fk_process_unit` FOREIGN KEY (`unit_id`) REFERENCES `audit_units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 7. TABLE: `audit_observations` (Audit Findings & Management Replies)
-- ==============================================================================
DROP TABLE IF EXISTS `audit_observations`;
CREATE TABLE `audit_observations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `daily_duty_id` BIGINT UNSIGNED NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `unit_id` SMALLINT UNSIGNED NOT NULL,
  `process_area_id` BIGINT UNSIGNED NULL,
  `custom_issue` TEXT NULL,
  `finding` TEXT NOT NULL,
  `management_reply` TEXT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'REVIEWED') NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `submitted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_observation_user` (`user_id`),
  INDEX `idx_observation_unit` (`unit_id`),
  INDEX `idx_observation_status` (`status`),
  CONSTRAINT `fk_observation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_observation_unit` FOREIGN KEY (`unit_id`) REFERENCES `audit_units` (`id`),
  CONSTRAINT `fk_observation_duty` FOREIGN KEY (`daily_duty_id`) REFERENCES `daily_duties` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_observation_process_area` FOREIGN KEY (`process_area_id`) REFERENCES `audit_process_areas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 8. TABLE: `complaints` (Audit Escalations & File Evidence Attachments)
-- ==============================================================================
DROP TABLE IF EXISTS `complaints`;
CREATE TABLE `complaints` (
  `id` VARCHAR(64) NOT NULL,
  `unit` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `urgency` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `remarks` TEXT NULL,
  `file_name` VARCHAR(255) NULL,
  `file_type` VARCHAR(100) NULL,
  `file_size_bytes` BIGINT UNSIGNED NULL,
  `file_url` TEXT NULL,
  `storage_key` VARCHAR(512) NULL,
  `auditor_id` VARCHAR(64) NOT NULL,
  `auditor_name` VARCHAR(191) NOT NULL,
  `manager_id` VARCHAR(64) NULL,
  `manager_name` VARCHAR(191) NULL,
  `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  `robot_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_cmp_unit` (`unit`),
  INDEX `idx_cmp_urgency` (`urgency`),
  INDEX `idx_cmp_status` (`status`),
  INDEX `idx_cmp_auditor` (`auditor_id`),
  CONSTRAINT `fk_complaints_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_complaints_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 9. TABLE: `tasks` (Directive Task Assignments)
-- ==============================================================================
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `created_by` VARCHAR(64) NOT NULL,
  `assigned_to` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `due_at` DATETIME(6) NULL,
  `status` ENUM('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_tasks_created_by` (`created_by`),
  INDEX `idx_tasks_assigned_to` (`assigned_to`),
  INDEX `idx_tasks_status` (`status`),
  INDEX `idx_tasks_due` (`due_at`),
  CONSTRAINT `fk_tasks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tasks_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 10. TABLE: `user_auditor_logs` (Master 11-Field Executive Duty Log Summary)
-- ==============================================================================
DROP TABLE IF EXISTS `user_auditor_logs`;
CREATE TABLE `user_auditor_logs` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `field1_login_time` VARCHAR(100) NOT NULL,
  `field2_full_name` VARCHAR(191) NOT NULL,
  `field3_student_reg_no` VARCHAR(100) NULL,
  `field4_unit_details` VARCHAR(255) NOT NULL,
  `field5_subunit_details` VARCHAR(255) NULL,
  `field6_audit_work_type` VARCHAR(255) NULL,
  `field7_work_objective` TEXT NULL,
  `field8_work_to_be_achieved` TEXT NULL,
  `field9_ca_remarks` TEXT NULL,
  `field10_poc_name` VARCHAR(191) NULL,
  `field11_logout_time` VARCHAR(100) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_logs_user_id` (`user_id`),
  INDEX `idx_logs_unit` (`field4_unit_details`),
  INDEX `idx_logs_user` (`field2_full_name`),
  INDEX `idx_logs_reg` (`field3_student_reg_no`),
  CONSTRAINT `fk_auditor_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- PRODUCTION SEED DATA (Official TTD Units & Primary Super Admin Account)
-- ==============================================================================

-- Seed: 8 Official TTD Audit Units
INSERT INTO `audit_units` (`code`, `name`, `active`, `sort_order`) VALUES
('PROCUREMENT',  'Procurement [Marketing Department]', 1, 1),
('WAREHOUSING',  'Warehousing [Marketing Department]', 1, 2),
('DONOR_CELL',   'Donor Cell along with Concurrent Audit on Donations, Allied Trusts and Srivani Trust Receipts [Tirumala]', 1, 3),
('KALYANAKATTA', 'Kalyanakatta & Kalyanavedika [Tirumala]', 1, 4),
('ANNAPRASADAM', 'Annaprasadam Trust and Canteens TML & TPT', 1, 5),
('SRI_PAT',      'Sri Padmavathi Ammavari Temple, Tiruchanoor (Sri PAT)', 1, 6),
('RECEPTION',    'Reception, TML including Marriage Halls', 1, 7),
('AUCTIONS',     'Auctions [Marketing Department]', 1, 8)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `active`=VALUES(`active`), `sort_order`=VALUES(`sort_order`);

-- Seed: Primary Super Admin Account (admin / admin123)
INSERT INTO `users` (`id`, `user_id`, `name`, `full_name`, `email`, `password`, `password_hash`, `role`, `role_title`, `unit`, `student_reg_no`, `registration_no`, `active`) VALUES
('usr-1', 'admin', 'Super Admin', 'CAO Administration', 'admin', 'admin123', SHA2('admin123',256), 'SUPER_ADMIN', 'Super Administrator', 'All Enterprise Units', 'FCA108920', 'TTD/CAO/001', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `role`=VALUES(`role`), `active`=VALUES(`active`);

SET FOREIGN_KEY_CHECKS = 1;
