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

// Static Dashboard Assets
app.get("/style.css", async () => {
  const file = Bun.file("./public/style.css");
  return new Response(await file.text(), {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
});

app.get("/app.js", async () => {
  const file = Bun.file("./public/app.js");
  return new Response(await file.text(), {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
});

app.get("/dashboard", async (c) => {
  const file = Bun.file("./public/index.html");
  return c.html(await file.text());
});

// Root & Health Check
app.get("/", async (c) => {
  const accept = c.req.header("Accept") || "";
  if (accept.includes("text/html")) {
    const file = Bun.file("./public/index.html");
    if (await file.exists()) {
      return c.html(await file.text());
    }
  }

  return c.json({
    name: "Curioverse API",
    phase: "Phase 7: YouTube Upload",
    status: "healthy",
    endpoints: {
      generate: "POST /api/content/generate",
      publish: "POST /api/content/publish",
      health: "GET /health",
      dashboard: "GET / (in browser) or GET /dashboard",
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
