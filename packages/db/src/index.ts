import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

export const { Pool } = pg;

export async function migrate(databaseUrl: string, migrationsDir: string): Promise<string[]> {
  const pool = new Pool({ connectionString: databaseUrl });
  const applied: string[] = [];
  try {
    await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const exists = await pool.query("select 1 from schema_migrations where name = $1", [file]);
      if (exists.rowCount) continue;
      const sql = await readFile(join(migrationsDir, file), "utf8");
      await pool.query("begin");
      await pool.query(sql);
      await pool.query("insert into schema_migrations (name) values ($1)", [file]);
      await pool.query("commit");
      applied.push(file);
    }
    return applied;
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
