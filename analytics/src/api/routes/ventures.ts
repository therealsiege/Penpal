import { Hono } from "hono";
import { ventures } from "../../shared/config.js";

const app = new Hono();

app.get("/ventures", (c) => {
  const ventureList = Object.entries(ventures).map(([key, v]) => ({
    key,
    name: v.name,
    enabled: v.enabled,
    directories: v.directories,
  }));

  return c.json(ventureList);
});

export default app;
