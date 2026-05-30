import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://scada:scada@localhost:5432/scada",
  apiPort: Number(process.env.API_PORT ?? 4100),
  nodeRedUrl: process.env.NODE_RED_URL ?? "http://localhost:1880",
  nodeRedAdminToken: process.env.NODE_RED_ADMIN_TOKEN || undefined
};
