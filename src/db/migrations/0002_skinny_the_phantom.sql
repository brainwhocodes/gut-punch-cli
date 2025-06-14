PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`queue_name` text NOT NULL,
	`priority` integer NOT NULL,
	`status` integer NOT NULL,
	`started_at` text,
	`finished_at` text,
	`output` text,
	`error` text
);
--> statement-breakpoint
INSERT INTO `__new_job_runs`("id", "job_name", "queue_name", "priority", "status", "started_at", "finished_at", "output", "error") SELECT "id", "job_name", "queue_name", "priority", "status", "started_at", "finished_at", "output", "error" FROM `job_runs`;--> statement-breakpoint
DROP TABLE `job_runs`;--> statement-breakpoint
ALTER TABLE `__new_job_runs` RENAME TO `job_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`reschedule` integer DEFAULT false NOT NULL,
	`reschedule_in` integer,
	`last_run_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "job_name", "status", "reschedule", "reschedule_in", "last_run_at") SELECT "id", "job_name", "status", "reschedule", "reschedule_in", "last_run_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_job_name_unique` ON `jobs` (`job_name`);