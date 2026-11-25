CREATE TABLE `cities` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`place_count` integer DEFAULT 0 NOT NULL,
	`area_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm` (
	`place_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'a_contacter' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`follow_up` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_follow_up_idx` ON `crm` (`follow_up`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`city_key` text NOT NULL,
	`name` text NOT NULL,
	`category_key` text NOT NULL,
	`category_value` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`housenumber` text,
	`street` text,
	`postcode` text,
	`city` text,
	`quartier` text,
	`phone` text,
	`email` text,
	`website` text,
	`opening_hours` text,
	`tags` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `places_city_idx` ON `places` (`city_key`);--> statement-breakpoint
CREATE TABLE `site_checks` (
	`place_id` text PRIMARY KEY NOT NULL,
	`url` text,
	`final_url` text,
	`checked_at` integer NOT NULL,
	`http_status` integer,
	`reachable` integer NOT NULL,
	`https` integer,
	`has_viewport` integer,
	`last_modified` text,
	`copyright_year` integer,
	`classification` text NOT NULL,
	`reasons` text,
	`error` text
);
