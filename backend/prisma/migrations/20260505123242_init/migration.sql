-- CreateTable
CREATE TABLE `User` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `profile_photo` LONGTEXT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'EMPLOYEE',
    `contact_number` VARCHAR(191) NULL,
    `mfa_secret` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `can_view_users` BOOLEAN NOT NULL DEFAULT false,
    `can_add_users` BOOLEAN NOT NULL DEFAULT false,
    `can_edit_users` BOOLEAN NOT NULL DEFAULT false,
    `can_delete_users` BOOLEAN NOT NULL DEFAULT false,
    `can_activate_users` BOOLEAN NOT NULL DEFAULT false,
    `can_view_own_attendance` BOOLEAN NOT NULL DEFAULT true,
    `can_view_all_attendance` BOOLEAN NOT NULL DEFAULT false,
    `can_edit_attendance` BOOLEAN NOT NULL DEFAULT false,
    `can_delete_attendance` BOOLEAN NOT NULL DEFAULT false,
    `can_export_attendance` BOOLEAN NOT NULL DEFAULT false,
    `can_view_equipment` BOOLEAN NOT NULL DEFAULT true,
    `can_add_equipment` BOOLEAN NOT NULL DEFAULT false,
    `can_edit_equipment` BOOLEAN NOT NULL DEFAULT false,
    `can_delete_equipment` BOOLEAN NOT NULL DEFAULT false,
    `can_assign_equipment` BOOLEAN NOT NULL DEFAULT false,
    `can_view_files` BOOLEAN NOT NULL DEFAULT true,
    `can_upload_files` BOOLEAN NOT NULL DEFAULT false,
    `can_edit_files` BOOLEAN NOT NULL DEFAULT false,
    `can_delete_files` BOOLEAN NOT NULL DEFAULT false,
    `can_download_files` BOOLEAN NOT NULL DEFAULT true,
    `can_view_inquiries` BOOLEAN NOT NULL DEFAULT false,
    `can_add_inquiries` BOOLEAN NOT NULL DEFAULT true,
    `can_update_inquiries` BOOLEAN NOT NULL DEFAULT false,
    `can_delete_inquiries` BOOLEAN NOT NULL DEFAULT false,
    `can_assign_inquiries` BOOLEAN NOT NULL DEFAULT false,
    `can_view_health_logs` BOOLEAN NOT NULL DEFAULT false,
    `can_export_health_logs` BOOLEAN NOT NULL DEFAULT false,
    `can_acknowledge_security_alerts` BOOLEAN NOT NULL DEFAULT false,
    `can_manage_permissions` BOOLEAN NOT NULL DEFAULT false,
    `can_view_audit_trail` BOOLEAN NOT NULL DEFAULT false,
    `can_backup_database` BOOLEAN NOT NULL DEFAULT false,
    `can_view_reports` BOOLEAN NOT NULL DEFAULT false,
    `can_export_attendance_report` BOOLEAN NOT NULL DEFAULT false,
    `can_export_equipment_report` BOOLEAN NOT NULL DEFAULT false,
    `can_export_inquiry_report` BOOLEAN NOT NULL DEFAULT false,
    `can_export_files_report` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance_Log` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `location_lat` DECIMAL(9, 6) NULL,
    `location_lng` DECIMAL(9, 6) NULL,
    `photo` TEXT NULL,

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment_Inventory` (
    `equipment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `condition` VARCHAR(191) NOT NULL DEFAULT 'Good',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Available',
    `assigned_to` INTEGER NULL,
    `current_location` VARCHAR(191) NULL,
    `qr_code` TEXT NULL,
    `qr_number` VARCHAR(191) NULL,
    `photo_url` TEXT NULL,
    `photo_public_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Equipment_Inventory_qr_number_key`(`qr_number`),
    PRIMARY KEY (`equipment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment_Checkout` (
    `checkout_id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipment_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `checkout_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `return_date` DATETIME(3) NULL,
    `location_lat` DECIMAL(9, 6) NULL,
    `location_lng` DECIMAL(9, 6) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Checked Out',
    `notes` TEXT NULL,

    PRIMARY KEY (`checkout_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project_File` (
    `file_id` INTEGER NOT NULL AUTO_INCREMENT,
    `uploader_id` INTEGER NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `file_size_mb` DECIMAL(10, 2) NOT NULL,
    `storage_location` VARCHAR(191) NOT NULL,
    `cloudinary_url` VARCHAR(191) NULL,
    `cloudinary_public_id` VARCHAR(191) NULL,
    `local_ftp_path` VARCHAR(191) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`file_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client_Inquiry` (
    `inquiry_id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_name` VARCHAR(191) NOT NULL,
    `client_email` VARCHAR(191) NOT NULL,
    `contact_number` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `message_body` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `handled_by` INTEGER NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`inquiry_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `System_Health_Log` (
    `sys_log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `ip_address` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`sys_log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Construction_Site` (
    `site_id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_name` VARCHAR(191) NOT NULL,
    `site_address` VARCHAR(191) NULL,
    `center_lat` DECIMAL(9, 6) NOT NULL,
    `center_lng` DECIMAL(9, 6) NOT NULL,
    `geo_fence_radius_meters` INTEGER NOT NULL DEFAULT 100,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Construction_Site_is_active_idx`(`is_active`),
    PRIMARY KEY (`site_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attendance_Log` ADD CONSTRAINT `Attendance_Log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment_Checkout` ADD CONSTRAINT `Equipment_Checkout_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `Equipment_Inventory`(`equipment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment_Checkout` ADD CONSTRAINT `Equipment_Checkout_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project_File` ADD CONSTRAINT `Project_File_uploader_id_fkey` FOREIGN KEY (`uploader_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client_Inquiry` ADD CONSTRAINT `Client_Inquiry_handled_by_fkey` FOREIGN KEY (`handled_by`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
