CREATE TABLE `bookPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ebookId` int NOT NULL,
	`position` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` mediumtext,
	`imagePrompt` text NOT NULL,
	`imageUrl` text,
	`status` enum('draft','generating','ready','reviewed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookPages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ebooks` ADD `bookType` enum('historybook','coloring') DEFAULT 'historybook' NOT NULL;--> statement-breakpoint
ALTER TABLE `ebooks` ADD `pageCount` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookPages` ADD CONSTRAINT `bookPages_ebookId_ebooks_id_fk` FOREIGN KEY (`ebookId`) REFERENCES `ebooks`(`id`) ON DELETE cascade ON UPDATE no action;