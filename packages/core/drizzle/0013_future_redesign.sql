ALTER TABLE `oneOff` ADD `kind` text DEFAULT 'cost' NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `superGrowthPct` real;--> statement-breakpoint
ALTER TABLE `workPhase` ADD `month` integer DEFAULT 1 NOT NULL;