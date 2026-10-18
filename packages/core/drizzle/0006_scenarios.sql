CREATE TABLE `scenario` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`colour` text DEFAULT 'blue' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`overrides` text DEFAULT '{}' NOT NULL
);
