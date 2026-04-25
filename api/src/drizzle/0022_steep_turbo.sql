CREATE TYPE "public"."shop_transaction_kind" AS ENUM('currency_grant', 'currency_charge', 'currency_refund', 'item_grant', 'item_purchase', 'item_consume');--> statement-breakpoint
CREATE TYPE "public"."shop_transaction_source" AS ENUM('owner_grant', 'bot_grant', 'post_reward', 'purchase', 'consume', 'refund');--> statement-breakpoint
CREATE TABLE "shop_balance" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_currency" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shop_inventory" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_amount" integer NOT NULL,
	"currency_id" uuid NOT NULL,
	"consumable" boolean DEFAULT false NOT NULL,
	"is_unique" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shop_transaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" "shop_transaction_kind" NOT NULL,
	"source" "shop_transaction_source" NOT NULL,
	"currency_id" uuid,
	"currency_delta" integer,
	"item_id" uuid,
	"item_qty_delta" integer,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_balance" ADD CONSTRAINT "shop_balance_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_balance" ADD CONSTRAINT "shop_balance_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_balance" ADD CONSTRAINT "shop_balance_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."shop_currency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_currency" ADD CONSTRAINT "shop_currency_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shop_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_item" ADD CONSTRAINT "shop_item_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_item" ADD CONSTRAINT "shop_item_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."shop_currency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_transaction" ADD CONSTRAINT "shop_transaction_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_transaction" ADD CONSTRAINT "shop_transaction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_transaction" ADD CONSTRAINT "shop_transaction_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."shop_currency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_transaction" ADD CONSTRAINT "shop_transaction_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shop_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_transaction" ADD CONSTRAINT "shop_transaction_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_shop_balance_per_holder" ON "shop_balance" USING btree ("community_id","profile_id","currency_id");--> statement-breakpoint
CREATE INDEX "idx_shop_balance_profile" ON "shop_balance" USING btree ("community_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_shop_currency_name_per_community" ON "shop_currency" USING btree ("community_id",LOWER("name")) WHERE "shop_currency"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_shop_currency_community_id" ON "shop_currency" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_shop_inventory_per_holder" ON "shop_inventory" USING btree ("community_id","profile_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_shop_inventory_profile" ON "shop_inventory" USING btree ("community_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_shop_item_name_per_community" ON "shop_item" USING btree ("community_id",LOWER("name")) WHERE "shop_item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_shop_item_community_id" ON "shop_item" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "idx_shop_transaction_community_created" ON "shop_transaction" USING btree ("community_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_shop_transaction_profile_created" ON "shop_transaction" USING btree ("community_id","profile_id","created_at");