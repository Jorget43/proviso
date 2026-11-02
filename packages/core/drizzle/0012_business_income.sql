CREATE TABLE `incomeSource` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`amount` real NOT NULL,
	`growthPct` real DEFAULT 3 NOT NULL,
	`startYear` integer NOT NULL,
	`endYear` integer
);
