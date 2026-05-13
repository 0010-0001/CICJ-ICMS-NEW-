-- AlterTable: expand Attendance_Log.photo from TEXT (64 KB) to MEDIUMTEXT (16 MB)
-- Fixes 500 error when storing base64-encoded attendance photos
ALTER TABLE `Attendance_Log` MODIFY `photo` MEDIUMTEXT NULL;
