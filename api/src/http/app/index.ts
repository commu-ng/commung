import { Hono } from "hono";
import type { AuthVariables } from "../../types";
import { communityBoardsRouter } from "./boards";
import { commandsRouter } from "./commands";
import { meRouter } from "./me";
import { messagesRouter } from "./messages";
import { notificationsRouter } from "./notifications";
import { postsRouter } from "./posts";
import { profilesRouter } from "./profiles";

export const appRouter = new Hono<{ Variables: AuthVariables }>()
  .route("/", profilesRouter)
  .route("/", meRouter)
  .route("/", messagesRouter)
  .route("/", notificationsRouter)
  .route("/", postsRouter)
  .route("/", commandsRouter)
  .route("/", communityBoardsRouter);
