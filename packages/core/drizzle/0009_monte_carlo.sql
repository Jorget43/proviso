ALTER TABLE `projectionSettings` ADD `showRange` integer;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `growthPct` real DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `glidePath` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `glideTargetPct` real DEFAULT 50 NOT NULL;