CREATE TABLE `chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ebookId` int NOT NULL,
	`position` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text,
	`content` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebookAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ebookId` int NOT NULL,
	`chapterId` int,
	`type` enum('cover','illustration') NOT NULL,
	`prompt` text NOT NULL,
	`imageUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ebookAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebookExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ebookId` int NOT NULL,
	`format` enum('pdf','epub','docx') NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`downloadUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ebookExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` text,
	`idea` text NOT NULL,
	`genre` varchar(120),
	`tone` varchar(120),
	`targetAudience` varchar(255),
	`visualStyle` varchar(160),
	`coverUrl` text,
	`status` enum('draft','generating','ready') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ebooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_ebookId_ebooks_id_fk` FOREIGN KEY (`ebookId`) REFERENCES `ebooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebookAssets` ADD CONSTRAINT `ebookAssets_ebookId_ebooks_id_fk` FOREIGN KEY (`ebookId`) REFERENCES `ebooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebookAssets` ADD CONSTRAINT `ebookAssets_chapterId_chapters_id_fk` FOREIGN KEY (`chapterId`) REFERENCES `chapters`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebookExports` ADD CONSTRAINT `ebookExports_ebookId_ebooks_id_fk` FOREIGN KEY (`ebookId`) REFERENCES `ebooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebooks` ADD CONSTRAINT `ebooks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;