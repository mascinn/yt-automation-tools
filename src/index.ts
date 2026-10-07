import { Hono } from "hono";
import { contentRoute } from "./routes/content.ts";

const app = new Hono();

// Global request logger
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
});

// Root & Health Check
app.get("/", (c) => {
  return c.json({
    name: "Curioverse API",
    phase: "Phase 7: YouTube Upload",
    status: "healthy",
    endpoints: {
      generate: "POST /api/content/generate",
      publish: "POST /api/content/publish",
      health: "GET /health",
    },
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    phase: 7,
  });
});

// Mount Content Routes
app.route("/api/content", contentRoute);

// Global Error Handler
app.onError((err, c) => {
  console.error("[Unhandled Server Error]:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

const port = Number(process.env.PORT) || 3000;
console.log(`Curioverse server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
