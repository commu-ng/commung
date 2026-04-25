CREATE TABLE "bot_command" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"installed_app_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"handler_builtin_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "installed_app" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"builtin_id" text NOT NULL,
	"version" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"installed_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bot_command" ADD CONSTRAINT "bot_command_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_command" ADD CONSTRAINT "bot_command_installed_app_id_fkey" FOREIGN KEY ("installed_app_id") REFERENCES "public"."installed_app"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_app" ADD CONSTRAINT "installed_app_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_app" ADD CONSTRAINT "installed_app_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_app" ADD CONSTRAINT "installed_app_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_bot_command_name_per_community" ON "bot_command" USING btree ("community_id",LOWER("name")) WHERE "bot_command"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_bot_command_installed_app_id" ON "bot_command" USING btree ("installed_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_installed_app_per_community" ON "installed_app" USING btree ("community_id","builtin_id") WHERE "installed_app"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_installed_app_community_id" ON "installed_app" USING btree ("community_id");