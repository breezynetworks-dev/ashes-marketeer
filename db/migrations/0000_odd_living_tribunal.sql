CREATE TYPE "public"."node" AS ENUM('New Aela', 'Halcyon', 'Joeva', 'Miraleth', 'Winstead');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('Common', 'Uncommon', 'Rare', 'Heroic', 'Epic', 'Legendary');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('success', 'failed', 'skipped', 'abandoned');--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"seller_name" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"rarity" "rarity" NOT NULL,
	"price_gold" integer NOT NULL,
	"price_silver" integer NOT NULL,
	"price_copper" integer NOT NULL,
	"total_price_copper" integer NOT NULL,
	"node" "node" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"rarity" "rarity" NOT NULL,
	"date" date NOT NULL,
	"avg_price" integer NOT NULL,
	"min_price" integer NOT NULL,
	"max_price" integer NOT NULL,
	"listing_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_count" integer NOT NULL,
	"token_usage" integer NOT NULL,
	"status" "upload_status" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE INDEX "active_listings_idx" ON "marketplace_listings" USING btree ("deleted_at") WHERE "marketplace_listings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "item_name_rarity_idx" ON "marketplace_listings" USING btree ("item_name","rarity");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "marketplace_listings" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "item_name_rarity_date_idx" ON "price_history" USING btree ("item_name","rarity","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "date_idx" ON "price_history" USING btree ("date");--> statement-breakpoint
CREATE INDEX "file_name_date_idx" ON "upload_history" USING btree ("file_name",DATE("processed_at"));--> statement-breakpoint
CREATE INDEX "processed_at_idx" ON "upload_history" USING btree ("processed_at" DESC NULLS LAST);