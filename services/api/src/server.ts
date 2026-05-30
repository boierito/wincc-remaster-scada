import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authenticateToken } from "./auth.js";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
  res.status(statusCode).json({ error: error instanceof Error ? error.message : "Unknown error" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.emit("connected", { ok: true });
  socket.on("tag:write", async (payload: { path: string; value: unknown; projectId: string; token?: string }) => {
    const user = await authenticateToken(payload.token);
    if (!user?.permissions.includes("runtime.write")) {
      socket.emit("tag:write:error", { path: payload.path, error: "Missing permission: runtime.write" });
      return;
    }
    const result = await pool.query(
      "update tags set last_value = $1, last_timestamp = now(), quality = 'good' where project_id = $2 and path = $3 returning id, path, last_value, quality, last_timestamp",
      [JSON.stringify(payload.value), payload.projectId, payload.path]
    );
    const sample = result.rows[0];
    io.emit("tag:sample", {
      tagId: sample.id,
      path: sample.path,
      value: sample.last_value,
      quality: sample.quality,
      timestamp: sample.last_timestamp,
      source: "runtime-write",
      connectionState: "online"
    });
  });
});

httpServer.listen(config.apiPort, () => {
  console.log(`SCADA API listening on http://localhost:${config.apiPort}`);
});
