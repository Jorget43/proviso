CREATE TABLE `child` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text,
	`birthYear` integer NOT NULL,
	`birthMonth` integer
);
--> statement-breakpoint
ALTER TABLE `incomeSettings` ADD `person1BirthYear` integer;--> statement-breakpoint
ALTER TABLE `incomeSettings` ADD `person2BirthYear` integer;