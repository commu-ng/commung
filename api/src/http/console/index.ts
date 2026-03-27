import { Hono } from "hono";
import { consoleAccountRouter } from "./account";
import { consoleAdminCommunitiesRouter } from "./admin-communities";
import { consoleBlocksRouter } from "./blocks";
import { consoleBoardsRouter } from "./boards";
import { consoleCommunitiesRouter } from "./communities/index";
import { consoleDevicesRouter } from "./devices";
import { consoleMasqueradeRouter } from "./masquerade";
import { consoleSearchRouter } from "./search";
import { uploadRouter } from "./upload";

export const consoleRouter = new Hono()
  .route("/", uploadRouter)
  .route("/", consoleAccountRouter)
  .route("/", consoleBlocksRouter)
  .route("/", consoleCommunitiesRouter)
  .route("/", consoleSearchRouter)
  .route("/", consoleBoardsRouter)
  .route("/", consoleMasqueradeRouter)
  .route("/", consoleDevicesRouter)
  .route("/", consoleAdminCommunitiesRouter);
