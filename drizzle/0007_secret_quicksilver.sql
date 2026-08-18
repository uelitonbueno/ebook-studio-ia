CREATE TABLE `imageLibrary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`imageUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `imageLibrary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `imageLibrary` ADD CONSTRAINT `imageLibrary_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;