DROP INDEX "file_name_date_idx";--> statement-breakpoint
ALTER TABLE "upload_history" ADD COLUMN "uploaded_by" varchar(100);--> statement-breakpoint
ALTER TABLE "upload_history" ADD COLUMN "node" "node";--> statement-breakpoint
CREATE INDEX "file_hash_idx" ON "upload_history" USING btree ("file_hash");