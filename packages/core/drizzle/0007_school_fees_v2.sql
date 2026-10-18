ALTER TABLE `child` ADD `primarySchool` text;--> statement-breakpoint
ALTER TABLE `child` ADD `secondarySchool` text;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `sfSib2Pct` real DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `sfSib3Pct` real DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `sfSib4Pct` real DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `sfFamilyFee` real DEFAULT 350 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `sfEntryFee` real DEFAULT 0 NOT NULL;