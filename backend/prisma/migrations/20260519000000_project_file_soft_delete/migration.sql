-- AlterTable: add is_archived flag to Project_File for soft-delete (archive/retrieve) architecture
ALTER TABLE `Project_File` ADD COLUMN `is_archived` BOOLEAN NOT NULL DEFAULT false;
