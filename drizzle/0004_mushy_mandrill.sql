ALTER TABLE `ebooks` MODIFY COLUMN `idea` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `objective` mediumtext;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `referenceNotes` mediumtext;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `discoveryAnalysis` mediumtext;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `tone` text;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `targetAudience` text;--> statement-breakpoint
ALTER TABLE `ebooks` MODIFY COLUMN `visualStyle` text;