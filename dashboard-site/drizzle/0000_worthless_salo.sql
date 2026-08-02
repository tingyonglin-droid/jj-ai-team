CREATE TABLE `approval_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`artifact_version` integer NOT NULL,
	`artifact_hash` text NOT NULL,
	`action` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_artifact_action_idx` ON `approval_events` (`artifact_id`,`artifact_version`,`action`);