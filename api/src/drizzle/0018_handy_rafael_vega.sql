ALTER TABLE "post" ADD COLUMN "bumped_at" timestamp with time zone;--> statement-breakpoint
-- Backfill bumpedAt for existing root posts: use latest reply's created_at, or the post's own created_at
UPDATE "post" p SET "bumped_at" = COALESCE(
  (SELECT MAX(r."created_at") FROM "post" r WHERE r."root_post_id" = p."id" AND r."deleted_at" IS NULL AND r."published_at" IS NOT NULL),
  p."created_at"
) WHERE p."depth" = 0;--> statement-breakpoint
CREATE INDEX "idx_post_community_id_bumped" ON "post" USING btree ("community_id" uuid_ops,"bumped_at" timestamptz_ops);