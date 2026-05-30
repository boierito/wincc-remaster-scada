import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { Script, createContext } from "node:vm";
import { Router } from "express";
import type { PoolClient } from "pg";
import { alignObjects, assignSequentialZ, propagateFaceplateType, translateWinccLikeScript, type AlignmentMode, type ScreenObject } from "@scada/domain";
import { NodeRedAdminClient, generateNodeRedFlow, mockBrowseSymbols, type ScadaConnection } from "@scada/node-red";
import { authMiddleware, bearerToken, createSession, hashPassword, requirePermission, revokeToken } from "./auth.js";
import { config } from "./config.js";
import { pool, query } from "./db.js";
import { getCrossReference, getProjectTree, getRuntimeManifest, rebuildCrossReferenceIndex } from "./repository.js";

export const router = Router();
router.use(authMiddleware());

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/auth/login", async (req, res, next) => {
  try {
    const session = await createSession(req.body.projectId, req.body.username, req.body.password);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    await revokeToken(bearerToken(req));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/session", (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "No active session" });
    return;
  }
  res.json({ user: req.authUser });
});

router.get("/projects", async (_req, res, next) => {
  try {
    res.json(await query("select * from projects order by created_at desc"));
  } catch (error) {
    next(error);
  }
});

router.post("/projects", requirePermission("engineering.edit"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, description = "" } = req.body;
    await client.query("begin");
    const projectResult = await client.query("insert into projects (name, description) values ($1, $2) returning *", [name, description]);
    const project = projectResult.rows[0];
    await createProjectDefaults(client, project.id);
    await client.query("commit");
    res.status(201).json(project);
  } catch (error) {
    await client.query("rollback");
    next(error);
  } finally {
    client.release();
  }
});

router.get("/projects/:projectId/tree", async (req, res, next) => {
  try {
    res.json(await getProjectTree(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/tags", async (req, res, next) => {
  try {
    res.json(await query("select * from tags where project_id = $1 order by path", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/providers", async (req, res, next) => {
  try {
    res.json(await query("select * from communication_providers where project_id = $1 order by name", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/providers", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [provider] = await query(
      `insert into communication_providers (project_id, key, name, driver, capabilities)
       values ($1,$2,$3,$4,$5)
       on conflict (project_id, key)
       do update set name = excluded.name, driver = excluded.driver, capabilities = excluded.capabilities
       returning *`,
      [req.params.projectId, body.key, body.name, body.driver, body.capabilities ?? {}]
    );
    res.status(201).json(provider);
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/tags", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [tag] = await query(
      "insert into tags (project_id, group_id, connection_id, udt_type_id, name, path, scope, data_type, address, properties) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *",
      [req.params.projectId, body.groupId ?? null, body.connectionId ?? null, body.udtTypeId ?? null, body.name, body.path, body.scope, body.dataType, body.address ?? null, body.properties ?? {}]
    );
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/connections", async (req, res, next) => {
  try {
    res.json(await query("select c.*, cp.key as provider_key, cp.driver from connections c join communication_providers cp on cp.id = c.provider_id where c.project_id = $1 order by c.name", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/connections", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [connection] = await query(
      "insert into connections (project_id, provider_id, name, endpoint, state, options) values ($1,$2,$3,$4,$5,$6) returning *",
      [req.params.projectId, body.providerId, body.name, body.endpoint, body.state ?? "disabled", body.options ?? {}]
    );
    res.status(201).json(connection);
  } catch (error) {
    next(error);
  }
});

router.patch("/connections/:connectionId", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [connection] = await query(
      "update connections set name = coalesce($2, name), endpoint = coalesce($3, endpoint), state = coalesce($4, state), options = coalesce($5, options) where id = $1 returning *",
      [req.params.connectionId, body.name ?? null, body.endpoint ?? null, body.state ?? null, body.options ?? null]
    );
    res.json(connection);
  } catch (error) {
    next(error);
  }
});

router.get("/connections/:connectionId/symbols", async (req, res, next) => {
  try {
    res.json(await query("select * from plc_symbols where connection_id = $1 order by symbol_path", [req.params.connectionId]));
  } catch (error) {
    next(error);
  }
});

router.post("/connections/:connectionId/browse", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [connection] = await query<any>(
      "select c.*, cp.key as provider_key from connections c join communication_providers cp on cp.id = c.provider_id where c.id = $1",
      [req.params.connectionId]
    );
    const symbols = req.body.symbols ?? mockBrowseSymbols({
      id: connection.id,
      name: connection.name,
      provider: connection.provider_key,
      endpoint: connection.endpoint,
      options: connection.options
    } as ScadaConnection);
    const saved = [];
    for (const symbol of symbols) {
      const [row] = await query(
        `insert into plc_symbols (project_id, connection_id, provider_key, symbol_path, address, data_type, direction, structure)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (connection_id, symbol_path)
         do update set address = excluded.address, data_type = excluded.data_type, direction = excluded.direction, structure = excluded.structure, discovered_at = now()
         returning *`,
        [connection.project_id, connection.id, connection.provider_key, symbol.symbolPath, symbol.address, symbol.dataType, symbol.direction ?? "readWrite", symbol.structure ?? {}]
      );
      saved.push(row);
    }
    await query("insert into connection_diagnostics (connection_id, state, quality, message, details) values ($1,$2,$3,$4,$5)", [
      connection.id,
      connection.state,
      connection.state === "online" ? "good" : "stale",
      `Browsed ${saved.length} symbol(s)`,
      { source: req.body.symbols ? "provided" : "mockBrowse" }
    ]);
    res.status(201).json({ symbols: saved });
  } catch (error) {
    next(error);
  }
});

router.post("/connections/:connectionId/symbols/import", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const symbols = await query<any>(
      "select ps.*, c.project_id from plc_symbols ps join connections c on c.id = ps.connection_id where ps.connection_id = $1 and ($2::uuid[] is null or ps.id = any($2::uuid[])) order by ps.symbol_path",
      [req.params.connectionId, req.body.symbolIds ?? null]
    );
    const imported = [];
    for (const symbol of symbols) {
      const name = String(symbol.symbol_path).split(".").at(-1) ?? symbol.symbol_path;
      const [tag] = await query<any>(
        `insert into tags (project_id, connection_id, name, path, scope, data_type, address, properties)
         values ($1,$2,$3,$4,'external',$5,$6,$7)
         on conflict (project_id, path)
         do update set connection_id = excluded.connection_id, data_type = excluded.data_type, address = excluded.address, properties = tags.properties || excluded.properties
         returning *`,
        [symbol.project_id, symbol.connection_id, name, symbol.symbol_path, symbol.data_type, symbol.address, { importedFromSymbolId: symbol.id, providerKey: symbol.provider_key }]
      );
      await query("update plc_symbols set imported_tag_id = $2 where id = $1", [symbol.id, tag.id]);
      imported.push(tag);
    }
    res.status(201).json({ imported });
  } catch (error) {
    next(error);
  }
});

router.get("/connections/:connectionId/diagnostics", async (req, res, next) => {
  try {
    res.json(await query("select * from connection_diagnostics where connection_id = $1 order by checked_at desc limit 50", [req.params.connectionId]));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/screens", async (req, res, next) => {
  try {
    const screens = await query("select * from screens where project_id = $1 order by name", [req.params.projectId]);
    const objects = await query("select so.* from screen_objects so join screens s on s.id = so.screen_id where s.project_id = $1 order by z_index", [req.params.projectId]);
    res.json({ screens, objects });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/screens", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [screen] = await query(
      "insert into screens (project_id, name, width, height, background) values ($1,$2,$3,$4,$5) returning *",
      [req.params.projectId, body.name, body.width ?? 1280, body.height ?? 720, body.background ?? { color: "#0f1720" }]
    );
    res.status(201).json(screen);
  } catch (error) {
    next(error);
  }
});

router.post("/screens/:screenId/objects", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [object] = await query(
      "insert into screen_objects (screen_id, type, name, x, y, width, height, z_index, properties, bindings, events) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *",
      [req.params.screenId, body.type, body.name, body.x ?? 0, body.y ?? 0, body.width ?? 120, body.height ?? 60, body.zIndex ?? 0, body.properties ?? {}, body.bindings ?? {}, body.events ?? {}]
    );
    res.status(201).json(object);
  } catch (error) {
    next(error);
  }
});

router.patch("/screen-objects/:objectId", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [object] = await query(
      "update screen_objects set name = coalesce($2, name), x = coalesce($3, x), y = coalesce($4, y), width = coalesce($5, width), height = coalesce($6, height), z_index = coalesce($7, z_index), properties = coalesce($8, properties), bindings = coalesce($9, bindings), events = coalesce($10, events) where id = $1 returning *",
      [req.params.objectId, body.name ?? null, body.x ?? null, body.y ?? null, body.width ?? null, body.height ?? null, body.zIndex ?? null, body.properties ?? null, body.bindings ?? null, body.events ?? null]
    );
    res.json(object);
  } catch (error) {
    next(error);
  }
});

router.post("/screens/:screenId/objects/align", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const ids = req.body.objectIds as string[];
    const mode = req.body.mode as AlignmentMode;
    const objects = await query<any>(
      "select id, screen_id as \"screenId\", type, name, x::float, y::float, width::float, height::float, z_index as \"zIndex\", properties, bindings, events from screen_objects where screen_id = $1 and id = any($2::uuid[])",
      [req.params.screenId, ids]
    );
    const aligned = alignObjects(objects as ScreenObject[], mode);
    for (const object of aligned) {
      await query("update screen_objects set x = $2, y = $3 where id = $1", [object.id, object.x, object.y]);
    }
    res.json({ objects: aligned });
  } catch (error) {
    next(error);
  }
});

router.post("/screens/:screenId/objects/z-order", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const ids = req.body.objectIds as string[];
    const objects = await query<any>(
      "select id, screen_id as \"screenId\", type, name, x::float, y::float, width::float, height::float, z_index as \"zIndex\", properties, bindings, events from screen_objects where screen_id = $1 and id = any($2::uuid[])",
      [req.params.screenId, ids]
    );
    const ordered = assignSequentialZ(objects as ScreenObject[], Number(req.body.start ?? 0));
    for (const object of ordered) {
      await query("update screen_objects set z_index = $2 where id = $1", [object.id, object.zIndex]);
    }
    res.json({ objects: ordered });
  } catch (error) {
    next(error);
  }
});

router.post("/screens/:screenId/object-groups", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [group] = await query(
      "insert into object_groups (screen_id, name, object_ids, properties) values ($1,$2,$3,$4) returning *",
      [req.params.screenId, req.body.name, req.body.objectIds, req.body.properties ?? {}]
    );
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/graphic-resources", async (req, res, next) => {
  try {
    const resources = await query("select * from graphic_resources where project_id = $1 order by name", [req.params.projectId]);
    const groups = await query("select og.* from object_groups og join screens s on s.id = og.screen_id where s.project_id = $1 order by og.name", [req.params.projectId]);
    res.json({ resources, groups });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/graphic-resources", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [resource] = await query(
      "insert into graphic_resources (project_id, name, kind, uri, metadata) values ($1,$2,$3,$4,$5) returning *",
      [req.params.projectId, req.body.name, req.body.kind ?? "symbol", req.body.uri, req.body.metadata ?? {}]
    );
    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/faceplates", async (req, res, next) => {
  try {
    const types = await query("select * from faceplate_types where project_id = $1 order by name, version desc", [req.params.projectId]);
    const instances = await query("select * from faceplate_instances where project_id = $1 order by name", [req.params.projectId]);
    res.json({ types, instances });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/faceplate-types", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [type] = await query(
      "insert into faceplate_types (project_id, name, version, interface, composition) values ($1,$2,$3,$4,$5) returning *",
      [req.params.projectId, body.name, body.version ?? 1, body.interface, body.composition ?? []]
    );
    res.status(201).json(type);
  } catch (error) {
    next(error);
  }
});

router.post("/faceplate-types/:typeId/new-version", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [current] = await query<any>("select * from faceplate_types where id = $1", [req.params.typeId]);
    const body = req.body;
    const [nextType] = await query(
      "insert into faceplate_types (project_id, name, version, interface, composition) values ($1,$2,$3,$4,$5) returning *",
      [current.project_id, current.name, Number(current.version) + 1, body.interface ?? current.interface, body.composition ?? current.composition]
    );
    res.status(201).json(nextType);
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/faceplate-instances", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [instance] = await query(
      "insert into faceplate_instances (project_id, screen_id, type_id, type_version, name, tag_bindings, property_overrides, event_overrides) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [req.params.projectId, body.screenId ?? null, body.typeId, body.typeVersion, body.name, body.tagBindings ?? {}, body.propertyOverrides ?? {}, body.eventOverrides ?? {}]
    );
    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

router.post("/faceplate-types/:typeId/propagate", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [nextType] = await query<any>("select id, project_id as \"projectId\", name, version, interface, composition from faceplate_types where id = $1", [req.params.typeId]);
    const instances = await query<any>(
      "select id, project_id as \"projectId\", type_id as \"typeId\", type_version as \"typeVersion\", name, tag_bindings as \"tagBindings\", property_overrides as \"propertyOverrides\", event_overrides as \"eventOverrides\" from faceplate_instances where type_id in (select id from faceplate_types where project_id = $1 and name = $2)",
      [nextType.projectId, nextType.name]
    );
    const results = [];
    for (const instance of instances) {
      const result = propagateFaceplateType(instance, nextType);
      await query(
        "update faceplate_instances set type_id = $2, type_version = $3, tag_bindings = $4 where id = $1",
        [instance.id, nextType.id, nextType.version, result.instance.tagBindings]
      );
      results.push(result);
    }
    res.json({ updated: results.length, results });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/alarms", async (req, res, next) => {
  try {
    const definitions = await query("select * from alarms where project_id = $1 order by name", [req.params.projectId]);
    const events = await query("select * from alarm_events where project_id = $1 order by raised_at desc limit 100", [req.params.projectId]);
    res.json({ definitions, events });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/alarms", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [alarm] = await query(
      "insert into alarms (project_id, class_id, source_tag_id, name, condition, message_template, ack_required, enabled) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [req.params.projectId, body.classId ?? null, body.sourceTagId ?? null, body.name, body.condition, body.messageTemplate, body.ackRequired ?? true, body.enabled ?? true]
    );
    res.status(201).json(alarm);
  } catch (error) {
    next(error);
  }
});

router.post("/alarm-events/:eventId/ack", requirePermission("runtime.ack"), async (req, res, next) => {
  try {
    const [event] = await query("update alarm_events set acked_at = now(), acked_by = $2 where id = $1 returning *", [req.params.eventId, req.body.userId ?? null]);
    res.json(event);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/historian/:archiveId/samples", async (req, res, next) => {
  try {
    res.json(await query("select * from historian_samples where archive_id = $1 and ts >= coalesce($2::timestamptz, now() - interval '1 day') order by ts asc", [req.params.archiveId, req.query.from ?? null]));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/historian", async (req, res, next) => {
  try {
    res.json(await query("select ha.*, t.path as tag_path from historian_archives ha join tags t on t.id = ha.tag_id where ha.project_id = $1 order by ha.name", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/historian", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [archive] = await query(
      "insert into historian_archives (project_id, tag_id, name, sample_mode, cycle_ms, retention_days) values ($1,$2,$3,$4,$5,$6) returning *",
      [req.params.projectId, body.tagId, body.name, body.sampleMode ?? "cyclic", body.cycleMs ?? 1000, body.retentionDays ?? 365]
    );
    res.status(201).json(archive);
  } catch (error) {
    next(error);
  }
});

router.post("/historian/:archiveId/samples", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [archive] = await query<any>("select * from historian_archives where id = $1", [req.params.archiveId]);
    const [sample] = await query(
      "insert into historian_samples (archive_id, tag_id, ts, value, quality, source) values ($1,$2,coalesce($3::timestamptz, now()),$4,$5,$6) returning *",
      [req.params.archiveId, archive.tag_id, body.timestamp ?? null, body.value, body.quality ?? "good", body.source ?? "api"]
    );
    res.status(201).json(sample);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/users", async (req, res, next) => {
  try {
    const users = await query("select id, username, display_name, enabled from users where project_id = $1 order by username", [req.params.projectId]);
    const groups = await query("select * from groups where project_id = $1 order by name", [req.params.projectId]);
    const permissions = await query("select * from permissions where project_id = $1 order by key", [req.params.projectId]);
    res.json({ users, groups, permissions });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/lists", async (req, res, next) => {
  try {
    const textLibraries = await query("select * from text_libraries where project_id = $1 order by name", [req.params.projectId]);
    const textItems = await query("select tli.* from text_list_items tli join text_libraries tl on tl.id = tli.library_id where tl.project_id = $1 order by list_name, key, locale", [req.params.projectId]);
    const graphicLists = await query("select * from graphic_lists where project_id = $1 order by name", [req.params.projectId]);
    const graphicItems = await query("select gli.* from graphic_list_items gli join graphic_lists gl on gl.id = gli.list_id where gl.project_id = $1 order by key", [req.params.projectId]);
    res.json({ textLibraries, textItems, graphicLists, graphicItems });
  } catch (error) {
    next(error);
  }
});

router.post("/text-libraries/:libraryId/items", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [item] = await query(
      "insert into text_list_items (library_id, list_name, key, locale, text) values ($1,$2,$3,$4,$5) returning *",
      [req.params.libraryId, body.listName, body.key, body.locale ?? "en-US", body.text]
    );
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/graphic-lists/:listId/items", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [item] = await query(
      "insert into graphic_list_items (list_id, key, asset_ref, metadata) values ($1,$2,$3,$4) returning *",
      [req.params.listId, body.key, body.assetRef, body.metadata ?? {}]
    );
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/user-archives", async (req, res, next) => {
  try {
    res.json(await query("select * from user_archives where project_id = $1 order by name", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/user-archives", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [archive] = await query(
      "insert into user_archives (project_id, name, schema, rows) values ($1,$2,$3,$4) returning *",
      [req.params.projectId, body.name, body.schema ?? [], body.rows ?? []]
    );
    res.status(201).json(archive);
  } catch (error) {
    next(error);
  }
});

router.post("/user-archives/:archiveId/rows", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [archive] = await query<any>("select rows from user_archives where id = $1", [req.params.archiveId]);
    const rows = [...(archive?.rows ?? []), req.body.row];
    const [updated] = await query("update user_archives set rows = $2 where id = $1 returning *", [req.params.archiveId, rows]);
    res.status(201).json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/scripts", async (req, res, next) => {
  try {
    res.json(await query("select * from scripts where project_id = $1 order by name", [req.params.projectId]));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/scripts", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [script] = await query(
      "insert into scripts (project_id, owner_kind, owner_id, name, language, trigger, source, enabled) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [req.params.projectId, body.ownerKind ?? "global", body.ownerId ?? null, body.name, body.language ?? "javascript", body.trigger ?? {}, body.source, body.enabled ?? true]
    );
    res.status(201).json(script);
  } catch (error) {
    next(error);
  }
});

router.post("/scripts/:scriptId/execute", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [script] = await query<any>("select * from scripts where id = $1", [req.params.scriptId]);
    const tagRows = await query<any>("select path, last_value from tags where project_id = $1", [script.project_id]);
    const tagCache = new Map(tagRows.map((tag) => [tag.path, tag.last_value]));
    const writes: Array<{ path: string; value: unknown }> = [];
    const openedPictures: Array<{ name: string; tagPrefix?: string }> = [];
    const ackedAlarmEvents: string[] = [];
    const source = script.language === "vbs-compat" || script.language === "c-compat" ? translateWinccLikeScript(script.source) : script.source;
    const api = {
      readTag: (path: string) => {
        return tagCache.get(path);
      },
      writeTag: (path: string, value: unknown) => {
        writes.push({ path, value });
        tagCache.set(path, value);
      },
      openPicture: (name: string, tagPrefix?: string) => {
        openedPictures.push({ name, tagPrefix });
      },
      acknowledgeAlarm: (eventId: string) => {
        ackedAlarmEvents.push(eventId);
      }
    };
    const context = createContext({ api, console: { log: () => undefined }, Math, Date });
    const result = await new Script(`(async () => { ${source} })()`).runInContext(context, { timeout: 250 });
    for (const write of writes) {
      await query("update tags set last_value = $1, last_timestamp = now(), quality = 'good' where project_id = $2 and path = $3", [JSON.stringify(write.value), script.project_id, write.path]);
    }
    for (const eventId of ackedAlarmEvents) {
      await query("update alarm_events set acked_at = now() where id = $1 and project_id = $2", [eventId, script.project_id]);
    }
    const payload = { result, writes, openedPictures, ackedAlarmEvents };
    await query("insert into script_execution_log (project_id, script_id, trigger_context, status, result) values ($1,$2,$3,'ok',$4)", [script.project_id, script.id, req.body.context ?? {}, payload]);
    res.json(payload);
  } catch (error) {
    try {
      await query("insert into script_execution_log (project_id, script_id, trigger_context, status, error) values (coalesce((select project_id from scripts where id = $1), $2), $1, $3, 'error', $4)", [req.params.scriptId, req.body.projectId, req.body.context ?? {}, error instanceof Error ? error.message : String(error)]);
    } catch {
      // Preserve the original execution error.
    }
    next(error);
  }
});

router.get("/projects/:projectId/cross-reference", async (req, res, next) => {
  try {
    const indexed = await query("select * from cross_reference_index where project_id = $1 order by reference_kind, reference, owner_kind", [req.params.projectId]);
    if (indexed.length) {
      res.json(indexed);
      return;
    }
    res.json(await getCrossReference(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/cross-reference/rebuild", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const hits = await rebuildCrossReferenceIndex(String(req.params.projectId));
    res.status(201).json({ count: hits.length, hits });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/reports", async (req, res, next) => {
  try {
    const reports = await query("select * from reports where project_id = $1 order by name", [req.params.projectId]);
    const runs = await query("select * from report_runs where project_id = $1 order by generated_at desc limit 50", [req.params.projectId]);
    res.json({ reports, runs });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/reports", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const body = req.body;
    const [report] = await query(
      "insert into reports (project_id, name, template, output_options) values ($1,$2,$3,$4) returning *",
      [req.params.projectId, body.name, body.template ?? {}, body.outputOptions ?? { formats: ["pdf", "csv"] }]
    );
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.post("/reports/:reportId/generate", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const [report] = await query<any>("select * from reports where id = $1", [req.params.reportId]);
    const format = req.body.format ?? "json";
    const payload = await buildReportPayload(report);
    const output = format === "csv" ? reportPayloadToCsv(payload) : JSON.stringify(payload, null, 2);
    const outputHash = createHash("sha256").update(output).digest("hex");
    const [run] = await query(
      "insert into report_runs (report_id, project_id, format, status, output_uri, payload) values ($1,$2,$3,'ok',$4,$5) returning *",
      [report.id, report.project_id, format, `memory://${report.id}/${outputHash}.${format}`, payload]
    );
    res.status(201).json({ run, output });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/node-red/sync", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const connections = await query<any>("select c.*, cp.key as provider_key from connections c join communication_providers cp on cp.id = c.provider_id where c.project_id = $1", [req.params.projectId]);
    const tags = await query<any>("select id, project_id as \"projectId\", name, path, data_type as \"dataType\", scope, connection_id as \"connectionId\", address, udt_type_id as \"udtTypeId\", properties from tags where project_id = $1", [req.params.projectId]);
    const flows = connections.map((connection) =>
      generateNodeRedFlow({
        id: connection.id,
        name: connection.name,
        provider: connection.provider_key,
        endpoint: connection.endpoint,
        options: connection.options
      } as ScadaConnection, tags)
    );
    if (req.body.deploy === true) {
      await new NodeRedAdminClient(config.nodeRedUrl, config.nodeRedAdminToken).deployFlows(flows);
    }
    res.json({ deployed: req.body.deploy === true, flows });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/runtime-manifest", async (req, res, next) => {
  try {
    res.json(await getRuntimeManifest(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/publish", requirePermission("engineering.edit"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const manifest = await getRuntimeManifest(projectId);
    const [bundle] = await query<any>("insert into published_bundles (project_id, version, manifest) values ($1, $2, $3) returning *", [req.params.projectId, req.body.version ?? new Date().toISOString(), manifest]);
    const items = publicationItems(bundle.id, manifest as Record<string, any>);
    for (const item of items) {
      await query("insert into runtime_publication_items (bundle_id, entity_kind, entity_id, name, checksum, metadata) values ($1,$2,$3,$4,$5,$6)", [
        item.bundleId,
        item.entityKind,
        item.entityId,
        item.name,
        item.checksum,
        item.metadata
      ]);
    }
    res.status(201).json(bundle);
  } catch (error) {
    next(error);
  }
});

router.post("/demo/reset", requirePermission("engineering.edit"), async (_req, res, next) => {
  try {
    const sql = await readFile(resolve(process.cwd(), "../../db/seeds/demo.sql"), "utf8");
    await pool.query(sql);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function publicationItems(bundleId: string, manifest: Record<string, any>) {
  const entitySets: Array<[string, any[]]> = [
    ["screen", manifest.screens ?? []],
    ["screenObject", manifest.objects ?? []],
    ["faceplateType", manifest.faceplateTypes ?? []],
    ["faceplateInstance", manifest.faceplateInstances ?? []],
    ["tag", manifest.tags ?? []],
    ["alarm", manifest.alarms ?? []],
    ["script", manifest.scripts ?? []],
    ["report", manifest.reports ?? []],
    ["userArchive", manifest.userArchives ?? []]
  ];
  return entitySets.flatMap(([entityKind, rows]) =>
    rows.map((row) => ({
      bundleId,
      entityKind,
      entityId: row.id ?? null,
      name: row.name ?? row.path ?? row.id,
      checksum: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      metadata: { publishedAt: new Date().toISOString() }
    }))
  );
}

async function createProjectDefaults(client: PoolClient, projectId: string) {
  await client.query(
    `insert into communication_providers (project_id, key, name, driver, capabilities)
     values
       ($1, 's7', 'Siemens S7', 'node-red-contrib-s7', '{"read":true,"write":true,"browse":true,"structures":true}'),
       ($1, 'opcua', 'OPC UA', 'node-red-contrib-opcua', '{"read":true,"write":true,"browse":true,"structures":true}'),
       ($1, 'mpi-ppi-dp', 'MPI/PPI/DP gateway', 'future-plugin', '{"planned":true}')`,
    [projectId]
  );
  await client.query("insert into tag_groups (project_id, name) values ($1, 'Process'), ($1, 'System')", [projectId]);
  await client.query(
    `insert into udt_types (project_id, name, fields)
     values ($1, 'EquipmentStatus', '{"Running":"bool","Fault":"bool","Speed":"float32"}')`,
    [projectId]
  );
  await client.query(
    `insert into tags (project_id, name, path, scope, data_type, properties, last_value, quality, last_timestamp)
     values
       ($1, 'ConnectionEnable', '@System.ConnectionEnable', 'system', 'bool', '{"purpose":"Enable or disable communication from runtime"}', 'true', 'good', now()),
       ($1, 'ConnectionState', '@System.ConnectionState', 'system', 'string', '{"purpose":"Aggregated communication state"}', '"stale"', 'stale', now()),
       ($1, 'CurrentUser', '@System.CurrentUser', 'system', 'string', '{"purpose":"Active runtime user"}', '"engineer"', 'good', now())`,
    [projectId]
  );
  const engineerGroup = await client.query("insert into groups (project_id, name, timeout_seconds) values ($1, 'Engineers', 1800) returning id", [projectId]);
  const operatorGroup = await client.query("insert into groups (project_id, name, timeout_seconds) values ($1, 'Operators', 900) returning id", [projectId]);
  const engineer = await client.query("insert into users (project_id, username, display_name, password_hash) values ($1, 'engineer', 'Engineer', $2) returning id", [projectId, hashPassword("engineer")]);
  const operator = await client.query("insert into users (project_id, username, display_name, password_hash) values ($1, 'operator', 'Operator', $2) returning id", [projectId, hashPassword("operator")]);
  await client.query("insert into user_groups (user_id, group_id) values ($1,$2),($3,$4)", [
    engineer.rows[0].id,
    engineerGroup.rows[0].id,
    operator.rows[0].id,
    operatorGroup.rows[0].id
  ]);
  for (const permission of ["engineering.edit", "runtime.write", "runtime.ack"]) {
    await client.query("insert into permissions (project_id, group_id, key) values ($1,$2,$3)", [projectId, engineerGroup.rows[0].id, permission]);
  }
  for (const permission of ["runtime.write", "runtime.ack"]) {
    await client.query("insert into permissions (project_id, group_id, key) values ($1,$2,$3)", [projectId, operatorGroup.rows[0].id, permission]);
  }
  await client.query("insert into screens (project_id, name, width, height, background) values ($1, 'Main', 1280, 720, '{\"color\":\"#101820\"}')", [projectId]);
  await client.query("insert into text_libraries (project_id, name, default_locale) values ($1, 'Default texts', 'en-US')", [projectId]);
  await client.query("insert into graphic_lists (project_id, name) values ($1, 'Default graphics')", [projectId]);
}

async function buildReportPayload(report: any) {
  const sections = Array.isArray(report.template?.sections) ? report.template.sections : [];
  const payloadSections = [];
  for (const section of sections) {
    if (section.kind === "alarms") {
      payloadSections.push({
        kind: "alarms",
        title: section.title ?? "Alarms",
        rows: await query(
          "select ae.message, ae.state, ae.raised_at, ae.cleared_at, ae.acked_at from alarm_events ae where ae.project_id = $1 order by ae.raised_at desc limit 100",
          [report.project_id]
        )
      });
    }
    if (section.kind === "historian") {
      const rows = await query(
        `select ha.name as archive_name, t.path as tag_path, hs.ts, hs.value, hs.quality
         from historian_samples hs
         join historian_archives ha on ha.id = hs.archive_id
         join tags t on t.id = hs.tag_id
         where ha.project_id = $1 and ($2::text is null or ha.name = $2)
         order by hs.ts desc limit 250`,
        [report.project_id, section.archive ?? null]
      );
      payloadSections.push({ kind: "historian", title: section.title ?? "Historian", rows });
    }
    if (section.kind === "userArchive") {
      const rows = await query("select name, schema, rows from user_archives where project_id = $1 and ($2::text is null or name = $2)", [report.project_id, section.archive ?? null]);
      payloadSections.push({ kind: "userArchive", title: section.title ?? "User archive", rows });
    }
  }
  return {
    report: { id: report.id, name: report.name },
    generatedAt: new Date().toISOString(),
    sections: payloadSections
  };
}

function reportPayloadToCsv(payload: any) {
  const lines = ["section,title,row"];
  for (const section of payload.sections ?? []) {
    for (const row of section.rows ?? []) {
      lines.push([section.kind, section.title, JSON.stringify(row)].map(csvCell).join(","));
    }
  }
  return lines.join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}
