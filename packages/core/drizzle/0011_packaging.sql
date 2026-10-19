CREATE TABLE `packagedItem` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`carPrice` real,
	`startYear` integer NOT NULL,
	`endYear` integer
);
