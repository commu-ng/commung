import { Hono } from "hono";
import { applicationsRouter } from "./applications";
import { boardsRouter } from "./boards";
import { botsRouter } from "./bots";
import { crudRouter } from "./crud";
import { installedAppsRouter } from "./installed-apps";
import { linksRouter } from "./links";
import { membersRouter } from "./members";
import { moderationRouter } from "./moderation";
import { shopRouter } from "./shop";
import { statsRouter } from "./stats";

export const consoleCommunitiesRouter = new Hono()
  .route("/communities", crudRouter)
  .route("/communities", statsRouter)
  .route("/communities", linksRouter)
  .route("/communities", membersRouter)
  .route("/communities", applicationsRouter)
  .route("/communities", moderationRouter)
  .route("/communities", botsRouter)
  .route("/communities", installedAppsRouter)
  .route("/communities", shopRouter)
  .route("/communities", boardsRouter);
