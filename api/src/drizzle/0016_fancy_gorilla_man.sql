CREATE TABLE "direct_message_deletion" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_direct_message_deletion" UNIQUE("message_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "group_chat_message_deletion" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_group_chat_message_deletion" UNIQUE("message_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "direct_message_deletion" ADD CONSTRAINT "direct_message_deletion_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."direct_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_deletion" ADD CONSTRAINT "direct_message_deletion_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_deletion" ADD CONSTRAINT "group_chat_message_deletion_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_deletion" ADD CONSTRAINT "group_chat_message_deletion_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;