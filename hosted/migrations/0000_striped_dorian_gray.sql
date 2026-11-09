CREATE TABLE `atelier_projects` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`data` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `atelier_owner_updated` ON `atelier_projects` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `entries` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`name` text NOT NULL,
	`tenths` integer NOT NULL,
	`nutrition` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`),
	CONSTRAINT "entry_meal" CHECK("entries"."meal" IN ('breakfast','lunch','dinner','snack')),
	CONSTRAINT "entry_tenths" CHECK("entries"."tenths" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
CREATE INDEX `entries_owner_date` ON `entries` (`owner`,`date`,`created_at`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_sources` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	`fetched` integer NOT NULL,
	PRIMARY KEY(`owner`, `provider`, `code`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`goal` integer,
	CONSTRAINT "profile_goal" CHECK("profiles"."goal" IS NULL OR ("profiles"."goal">0 AND "profiles"."goal"<=20000))
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`owner` text NOT NULL,
	`bucket` text NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`owner`, `bucket`)
);

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS entries_insert_conflict BEFORE INSERT ON entries
WHEN EXISTS (
  SELECT 1 FROM entries WHERE owner=NEW.owner AND id=NEW.id
  AND (date<>NEW.date OR meal<>NEW.meal OR name<>NEW.name OR tenths<>NEW.tenths OR nutrition IS NOT NEW.nutrition)
)
BEGIN
  SELECT RAISE(ABORT,'ENTRY_CONTENT_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS entries_insert_capacity BEFORE INSERT ON entries
WHEN NOT EXISTS (SELECT 1 FROM entries WHERE owner=NEW.owner AND id=NEW.id)
  AND (SELECT count(*) FROM entries WHERE owner=NEW.owner)>=20000
BEGIN
  SELECT RAISE(ABORT,'JOURNAL_FULL');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS atelier_insert_capacity BEFORE INSERT ON atelier_projects
WHEN (SELECT count(*) FROM atelier_projects WHERE owner=NEW.owner)>=50
BEGIN
  SELECT RAISE(ABORT,'PROJECT_LIMIT');
END;
