import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { configureLogger, logger } from "./config/logger";
import { AppException } from "./exception";
import { appRouter } from "./http/app/index";
import { auth } from "./http/auth";
import { botApiRouter } from "./http/bot/index";
import { consoleRouter } from "./http/console";
import { startScheduler } from "./services/scheduler.service";
import { GeneralErrorCode } from "./types/api-responses";

// Configure logger
await configureLogger();

Sentry.init({
  dsn: env.sentry.dsn,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

// Create the main app with middleware
const app = new Hono()
  .use(
    "/*",
    cors({
      origin: (origin) => {
        const domain = env.consoleDomain;

        // Allow requests from the main domain and all subdomains
        if (!origin) return origin; // Allow requests with no origin (like Postman)

        const originHost = new URL(origin).hostname;

        // Allow exact domain match or subdomain
        if (originHost === domain || originHost.endsWith(`.${domain}`)) {
          return origin;
        }

        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
    }),
  )
  .get("/", (c) => {
    return c.text("OK");
  })
  .get("/health", (c) => {
    return c.text("OK");
  })
  .route("/auth", auth)
  .route("/app", appRouter)
  .route("/console", consoleRouter)
  .route("/bot", botApiRouter)
  .onError((err, c) => {
    if (err instanceof AppException) {
      logger.http.warn("AppException: {message}", { message: err.message });
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            ...(err.details && { details: err.details }),
          },
        },
        err.statusCode,
      );
    }

    logger.http.error("Unhandled error: {message} {stack}", {
      message: err.message,
      stack: err.stack,
    });
    Sentry.captureException(err);

    return c.json(
      {
        error: {
          code: GeneralErrorCode.INTERNAL_SERVER_ERROR,
          message: "Internal Server Error",
        },
      },
      500,
    );
  });

const port = env.port;

logger.http.info("Starting server on port {port}", { port });

// Start the post scheduler
startScheduler();

serve({
  fetch: app.fetch,
  port,
});

import type { ApplyGlobalResponse } from "hono/client";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

type GlobalResponse = {
  400: { json: ErrorResponse };
  401: { json: ErrorResponse };
  403: { json: ErrorResponse };
  404: { json: ErrorResponse };
  409: { json: ErrorResponse };
  422: { json: ErrorResponse };
  429: { json: ErrorResponse };
  500: { json: ErrorResponse };
  503: { json: ErrorResponse };
};

export type AppType = ApplyGlobalResponse<typeof app, GlobalResponse>;
