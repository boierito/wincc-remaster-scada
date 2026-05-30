import "dotenv/config";
import { Script, createContext } from "node:vm";
import pg from "pg";
import { io } from "socket.io-client";
import { evaluateAlarmCondition, translateWinccLikeScript } from "@scada/domain";
import { generateNodeRedFlow, NodeRedAdminClient, type ScadaConnection } from "@scada/node-red";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://scada:scada@localhost:5432/scada";
const apiUrl = process.env.API_URL ?? "http://localhost:4100";
const nodeRedUrl = process.env.NODE_RED_URL ?? "http://localhost:1880";
const nodeRedAdminToken = process.env.NODE_RED_ADMIN_TOKEN || undefined;

const pool = new pg.Pool({ connectionString: databaseUrl });
const socket = io(apiUrl);
const previousTagValues = new Map<string, unknown>();
const timerScriptLastRun = new Map<string, number>();

async function synchronizeNodeRed(projectId: string, deploy = false) {
  const connections = await pool.query("select c.*, cp.key as provider_key from connections c join communication_providers cp on cp.id = c.provider_id where c.project_id = $1", [projectId]);
  const tags = await pool.query("select id, project_id as \"projectId\", name, path, data_type as \"dataType\", scope, connection_id as \"connectionId\", address, udt_type_id as \"udtTypeId\", properties from tags where project_id = $1", [projectId]);
  const flows = connections.rows.map((connection) =>
    generateNodeRedFlow({
      id: connection.id,
      name: connection.name,
      provider: connection.provider_key,
      endpoint: connection.endpoint,
      options: connection.options
    } as ScadaConnection, tags.rows)
  );
  if (deploy) await new NodeRedAdminClient(nodeRedUrl, nodeRedAdminToken).deployFlows(flows);
  return flows;
}

socket.on("connect", () => console.log("Acquisition worker connected to API socket"));
socket.on("node-red:sync", async (message: { projectId: string; deploy?: boolean }) => {
  const flows = await synchronizeNodeRed(message.projectId, message.deploy);
  socket.emit("node-red:synced", { projectId: message.projectId, flowCount: flows.length });
});

setInterval(async () => {
  const samples = await pool.query("select id, project_id, path, last_value, quality, last_timestamp from tags where last_timestamp is not null order by last_timestamp desc limit 50");
  for (const sample of samples.rows) {
    socket.emit("tag:sample", {
      tagId: sample.id,
      path: sample.path,
      value: sample.last_value,
      quality: sample.quality,
      timestamp: sample.last_timestamp,
      source: "postgres-cache",
      connectionState: sample.quality === "disabled" ? "disabled" : "online"
    });
  }
}, 2000);

setInterval(async () => {
  await archiveHistorianSamples();
  await evaluateAlarmDefinitions();
  await runTimerScripts();
  await runTagChangeScripts();
}, Number(process.env.ACQUISITION_CYCLE_MS ?? 1000));

async function archiveHistorianSamples() {
  const archives = await pool.query(`
    select ha.id as archive_id, ha.tag_id, ha.cycle_ms, t.project_id, t.path, t.last_value, t.quality, t.last_timestamp
    from historian_archives ha
    join tags t on t.id = ha.tag_id
    where t.last_timestamp is not null
  `);
  for (const archive of archives.rows) {
    const recent = await pool.query(
      "select 1 from historian_samples where archive_id = $1 and ts > now() - ($2::text || ' milliseconds')::interval limit 1",
      [archive.archive_id, archive.cycle_ms]
    );
    if (recent.rowCount) continue;
    await pool.query(
      "insert into historian_samples (archive_id, tag_id, ts, value, quality, source) values ($1,$2,coalesce($3, now()),$4,$5,$6) on conflict do nothing",
      [archive.archive_id, archive.tag_id, archive.last_timestamp, archive.last_value, archive.quality ?? "stale", "acquisition-worker"]
    );
  }
}

async function evaluateAlarmDefinitions() {
  const alarms = await pool.query(`
    select a.*, t.last_value, t.quality, t.project_id
    from alarms a
    left join tags t on t.id = a.source_tag_id
    where a.enabled = true
  `);
  for (const alarm of alarms.rows) {
    const active = evaluateAlarmCondition(alarm.condition, normalizeValue(alarm.last_value));
    const openEvent = await pool.query("select id from alarm_events where alarm_id = $1 and cleared_at is null order by raised_at desc limit 1", [alarm.id]);
    if (active && !openEvent.rowCount) {
      await pool.query(
        "insert into alarm_events (alarm_id, project_id, state, message, value) values ($1,$2,'active',$3,$4)",
        [alarm.id, alarm.project_id, alarm.message_template, alarm.last_value]
      );
    }
    if (!active && openEvent.rowCount) {
      await pool.query("update alarm_events set state = 'cleared', cleared_at = now() where id = $1", [openEvent.rows[0].id]);
    }
  }
}

function normalizeValue(value: unknown) {
  if (value && typeof value === "object" && "value" in value) return (value as { value: unknown }).value;
  return value;
}

async function runTimerScripts() {
  const scripts = await pool.query("select * from scripts where enabled = true and trigger->>'type' = 'timer'");
  const now = Date.now();
  for (const script of scripts.rows) {
    const intervalMs = Number(script.trigger?.intervalMs ?? 1000);
    const lastRun = timerScriptLastRun.get(script.id) ?? 0;
    if (now - lastRun < intervalMs) continue;
    timerScriptLastRun.set(script.id, now);
    await executeScript(script, { trigger: "timer", intervalMs });
  }
}

async function runTagChangeScripts() {
  const scripts = await pool.query("select * from scripts where enabled = true and trigger->>'type' = 'tag-change'");
  if (!scripts.rowCount) return;
  const tags = await pool.query("select project_id, path, last_value from tags where last_timestamp is not null");
  const current = new Map(tags.rows.map((tag) => [`${tag.project_id}:${tag.path}`, tag.last_value]));
  for (const script of scripts.rows) {
    const path = script.trigger?.tag;
    if (!path) continue;
    const key = `${script.project_id}:${path}`;
    const before = JSON.stringify(previousTagValues.get(key));
    const after = JSON.stringify(current.get(key));
    if (previousTagValues.has(key) && before !== after) {
      await executeScript(script, { trigger: "tag-change", tag: path, previous: previousTagValues.get(key), current: current.get(key) });
    }
  }
  previousTagValues.clear();
  for (const [key, value] of current.entries()) previousTagValues.set(key, value);
}

async function executeScript(script: any, triggerContext: Record<string, unknown>) {
  try {
    const tagRows = await pool.query("select path, last_value from tags where project_id = $1", [script.project_id]);
    const tagCache = new Map(tagRows.rows.map((tag) => [tag.path, tag.last_value]));
    const writes: Array<{ path: string; value: unknown }> = [];
    const openedPictures: Array<{ name: string; tagPrefix?: string }> = [];
    const ackedAlarmEvents: string[] = [];
    const source = script.language === "vbs-compat" || script.language === "c-compat" ? translateWinccLikeScript(script.source) : script.source;
    const api = {
      readTag: (path: string) => tagCache.get(path),
      writeTag: (path: string, value: unknown) => {
        writes.push({ path, value });
        tagCache.set(path, value);
      },
      openPicture: (name: string, tagPrefix?: string) => openedPictures.push({ name, tagPrefix }),
      acknowledgeAlarm: (eventId: string) => ackedAlarmEvents.push(eventId)
    };
    const context = createContext({ api, console: { log: () => undefined }, Math, Date });
    const result = await new Script(`(async () => { ${source} })()`).runInContext(context, { timeout: 250 });
    for (const write of writes) {
      await pool.query("update tags set last_value = $1, last_timestamp = now(), quality = 'good' where project_id = $2 and path = $3", [JSON.stringify(write.value), script.project_id, write.path]);
    }
    for (const eventId of ackedAlarmEvents) {
      await pool.query("update alarm_events set acked_at = now() where id = $1 and project_id = $2", [eventId, script.project_id]);
    }
    await pool.query("insert into script_execution_log (project_id, script_id, trigger_context, status, result) values ($1,$2,$3,'ok',$4)", [script.project_id, script.id, triggerContext, { result, writes, openedPictures, ackedAlarmEvents }]);
  } catch (error) {
    await pool.query("insert into script_execution_log (project_id, script_id, trigger_context, status, error) values ($1,$2,$3,'error',$4)", [script.project_id, script.id, triggerContext, error instanceof Error ? error.message : String(error)]);
  }
}

console.log("SCADA acquisition worker started");
