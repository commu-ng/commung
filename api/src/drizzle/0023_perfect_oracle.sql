CREATE TYPE "public"."user_notification_type" AS ENUM('board_reply');--> statement-breakpoint
CREATE TABLE "user_notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"type" "user_notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"board_post_id" uuid,
	"board_post_reply_id" uuid,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_board_post_id_fkey" FOREIGN KEY ("board_post_id") REFERENCES "public"."board_post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_board_post_reply_id_fkey" FOREIGN KEY ("board_post_reply_id") REFERENCES "public"."board_post_reply"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_notification_unread" ON "user_notification" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "valid_user_notification_read_at" CHECK (read_at IS NULL OR read_at >= created_at);