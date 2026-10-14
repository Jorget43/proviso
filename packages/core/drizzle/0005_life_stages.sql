ALTER TABLE `householdSettings` ADD `state` text;--> statement-breakpoint
ALTER TABLE `householdSettings` ADD `regional` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `lifeStagesOn` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `projectionSettings` ADD `childLeavesHomeAge` integer DEFAULT 18 NOT NULL;