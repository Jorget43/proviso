ALTER TABLE `projectionSettings` ADD `horizonAge` integer DEFAULT 95 NOT NULL;--> statement-breakpoint
ALTER TABLE `superSettings` ADD `drawdownStrategy` text DEFAULT 'need' NOT NULL;--> statement-breakpoint
ALTER TABLE `superSettings` ADD `drawdownPct` real DEFAULT 5 NOT NULL;