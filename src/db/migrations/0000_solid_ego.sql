CREATE TABLE `job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`queue_name` text NOT NULL,
	`priority` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`output` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`job_name` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`job_name` text PRIMARY KEY NOT NULL,
	`next_run` text NOT NULL
);
