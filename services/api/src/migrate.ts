import { resolve } from "node:path";
import { migrate } from "@scada/db";
import { config } from "./config.js";

const applied = await migrate(config.databaseUrl, resolve(process.cwd(), "../../db/migrations"));
console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "No pending migrations");
