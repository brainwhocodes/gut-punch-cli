PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reschedule` integer DEFAULT false NOT NULL,
	`reschedule_in` integer,
	`last_run_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "job_name", "status", "reschedule", "reschedule_in", "last_run_at") SELECT "id", "job_name", "status", "reschedule", "reschedule_in", "last_run_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_job_name_unique` ON `jobs` (`job_name`);