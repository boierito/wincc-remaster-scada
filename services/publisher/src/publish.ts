import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const projectId = process.argv[2];
if (!projectId) throw new Error("Usage: tsx src/publish.ts <project-id>");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://scada:scada@localhost:5432/scada" });

async function rows(sql: string, params: unknown[]) {
  return (await pool.query(sql, params)).rows;
}

const manifest: Record<string, any> = {
  project: (await rows("select * from projects where id = $1", [projectId]))[0],
  screens: await rows("select * from screens where project_id = $1 order by name", [projectId]),
  objects: await rows("select so.* from screen_objects so join screens s on s.id = so.screen_id where s.project_id = $1 order by z_index", [projectId]),
  faceplateTypes: await rows("select * from faceplate_types where project_id = $1", [projectId]),
  faceplateInstances: await rows("select * from faceplate_instances where project_id = $1", [projectId]),
  tags: await rows("select id, path, data_type, scope, properties from tags where project_id = $1 order by path", [projectId]),
  alarms: await rows("select * from alarms where project_id = $1", [projectId]),
  historian: await rows("select * from historian_archives where project_id = $1", [projectId]),
  scripts: await rows("select * from scripts where project_id = $1 and enabled = true", [projectId]),
  reports: await rows("select * from reports where project_id = $1 order by name", [projectId]),
  reportRuns: await rows("select * from report_runs where project_id = $1 order by generated_at desc limit 50", [projectId]),
  graphicResources: await rows("select * from graphic_resources where project_id = $1 order by name", [projectId]),
  generatedAt: new Date().toISOString()
};

const outputDir = resolve(process.cwd(), "../../published", projectId);
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const bundle = await pool.query("insert into published_bundles (project_id, version, manifest) values ($1, $2, $3) returning id", [projectId, manifest.generatedAt, manifest]);
for (const item of publicationItems(bundle.rows[0].id, manifest)) {
  await pool.query("insert into runtime_publication_items (bundle_id, entity_kind, entity_id, name, checksum, metadata) values ($1,$2,$3,$4,$5,$6)", [
    item.bundleId,
    item.entityKind,
    item.entityId,
    item.name,
    item.checksum,
    item.metadata
  ]);
}
await pool.end();
console.log(`Published runtime manifest to ${outputDir}`);

function publicationItems(bundleId: string, manifest: Record<string, any>) {
  const entitySets: Array<[string, any[]]> = [
    ["screen", manifest.screens ?? []],
    ["screenObject", manifest.objects ?? []],
    ["faceplateType", manifest.faceplateTypes ?? []],
    ["faceplateInstance", manifest.faceplateInstances ?? []],
    ["tag", manifest.tags ?? []],
    ["alarm", manifest.alarms ?? []],
    ["historianArchive", manifest.historian ?? []],
    ["script", manifest.scripts ?? []],
    ["report", manifest.reports ?? []],
    ["reportRun", manifest.reportRuns ?? []],
    ["graphicResource", manifest.graphicResources ?? []]
  ];
  return entitySets.flatMap(([entityKind, rows]) =>
    rows.map((row) => ({
      bundleId,
      entityKind,
      entityId: row.id ?? null,
      name: row.name ?? row.path ?? row.id,
      checksum: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      metadata: { file: "manifest.json" }
    }))
  );
}
