import { findCrossReferences } from "@scada/domain";
import { query } from "./db.js";

export async function getProjectTree(projectId: string) {
  const [project] = await query<{ id: string; name: string }>("select id, name from projects where id = $1", [projectId]);
  const screens = await query<{ id: string; name: string }>("select id, name from screens where project_id = $1 order by name", [projectId]);
  const tags = await query<{ id: string; path: string }>("select id, path from tags where project_id = $1 order by path", [projectId]);
  const scripts = await query<{ id: string; name: string }>("select id, name from scripts where project_id = $1 order by name", [projectId]);
  const faceplates = await query<{ id: string; name: string; version: number }>("select id, name, version from faceplate_types where project_id = $1 order by name, version desc", [projectId]);
  return {
    id: project?.id ?? projectId,
    label: project?.name ?? "Unknown project",
    kind: "project",
    children: [
      { id: "screens", label: "Screens", kind: "folder", children: screens.map((screen) => ({ id: screen.id, label: screen.name, kind: "screen" })) },
      { id: "tags", label: "Tags", kind: "folder", children: tags.map((tag) => ({ id: tag.id, label: tag.path, kind: "tag" })) },
      { id: "faceplates", label: "Faceplates", kind: "folder", children: faceplates.map((fp) => ({ id: fp.id, label: `${fp.name} v${fp.version}`, kind: "faceplate" })) },
      { id: "scripts", label: "Scripts", kind: "folder", children: scripts.map((script) => ({ id: script.id, label: script.name, kind: "script" })) },
      { id: "alarms", label: "Alarm Logging", kind: "alarm" },
      { id: "historian", label: "Tag Logging", kind: "historian" },
      { id: "users", label: "User Administration", kind: "user" },
      { id: "lists", label: "Text and Graphic Lists", kind: "list" }
    ]
  };
}

export async function getRuntimeManifest(projectId: string) {
  const [project] = await query("select * from projects where id = $1", [projectId]);
  const screens = await query("select * from screens where project_id = $1 order by name", [projectId]);
  const objects = await query("select so.* from screen_objects so join screens s on s.id = so.screen_id where s.project_id = $1 order by z_index", [projectId]);
  const faceplateTypes = await query("select * from faceplate_types where project_id = $1", [projectId]);
  const faceplateInstances = await query("select * from faceplate_instances where project_id = $1", [projectId]);
  const tags = await query("select * from tags where project_id = $1 order by path", [projectId]);
  const alarms = await query("select * from alarms where project_id = $1", [projectId]);
  const alarmEvents = await query("select * from alarm_events where project_id = $1 order by raised_at desc limit 100", [projectId]);
  const scripts = await query("select * from scripts where project_id = $1 and enabled = true", [projectId]);
  const textLists = await query("select tli.* from text_list_items tli join text_libraries tl on tl.id = tli.library_id where tl.project_id = $1", [projectId]);
  const graphicLists = await query("select gli.* from graphic_list_items gli join graphic_lists gl on gl.id = gli.list_id where gl.project_id = $1", [projectId]);
  const graphicResources = await query("select * from graphic_resources where project_id = $1 order by name", [projectId]);
  const permissions = await query("select g.name as group_name, p.key, p.allowed from permissions p join groups g on g.id = p.group_id where p.project_id = $1", [projectId]);
  const reports = await query("select * from reports where project_id = $1 order by name", [projectId]);
  const userArchives = await query("select * from user_archives where project_id = $1 order by name", [projectId]);
  return { project, screens, objects, faceplateTypes, faceplateInstances, tags, alarms, alarmEvents, scripts, textLists, graphicLists, graphicResources, permissions, reports, userArchives };
}

export async function getCrossReference(projectId: string) {
  const tags = await query<any>("select id, project_id as \"projectId\", name, path, data_type as \"dataType\", scope, connection_id as \"connectionId\", address, udt_type_id as \"udtTypeId\", properties from tags where project_id = $1", [projectId]);
  const screens = await query<{ id: string; name: string }>("select id, name from screens where project_id = $1", [projectId]);
  const objects = await query<any>("select so.id, so.screen_id as \"screenId\", so.type, so.name, so.x::float, so.y::float, so.width::float, so.height::float, so.z_index as \"zIndex\", so.properties, so.bindings, so.events from screen_objects so join screens s on s.id = so.screen_id where s.project_id = $1", [projectId]);
  const faceplateTypes = await query<any>("select id, name, interface, composition from faceplate_types where project_id = $1", [projectId]);
  const faceplateInstances = await query<any>("select id, project_id as \"projectId\", type_id as \"typeId\", type_version as \"typeVersion\", name, tag_bindings as \"tagBindings\", property_overrides as \"propertyOverrides\", event_overrides as \"eventOverrides\" from faceplate_instances where project_id = $1", [projectId]);
  const scripts = await query<{ id: string; name: string; source: string; trigger: Record<string, unknown> }>("select id, name, source, trigger from scripts where project_id = $1", [projectId]);
  const alarms = await query<any>("select a.id, t.path as \"sourceTagPath\", a.condition, a.message_template as \"messageTemplate\" from alarms a left join tags t on t.id = a.source_tag_id where a.project_id = $1", [projectId]);
  const historianArchives = await query<any>("select ha.id, ha.name, t.path as \"tagPath\" from historian_archives ha join tags t on t.id = ha.tag_id where ha.project_id = $1", [projectId]);
  const reports = await query<any>("select id, name, template from reports where project_id = $1", [projectId]);
  const textItems = await query<any>("select tli.id, tli.list_name as \"listName\", tli.key, tli.text from text_list_items tli join text_libraries tl on tl.id = tli.library_id where tl.project_id = $1", [projectId]);
  const graphicItems = await query<any>("select gli.id, gli.key, gli.asset_ref as \"assetRef\" from graphic_list_items gli join graphic_lists gl on gl.id = gli.list_id where gl.project_id = $1", [projectId]);
  const userArchives = await query<any>("select id, name, schema, rows from user_archives where project_id = $1", [projectId]);
  return findCrossReferences({ tags, screens, objects, faceplateTypes, faceplateInstances, scripts, alarms, historianArchives, reports, textItems, graphicItems, userArchives });
}

export async function rebuildCrossReferenceIndex(projectId: string) {
  const hits = await getCrossReference(projectId);
  await query("delete from cross_reference_index where project_id = $1", [projectId]);
  for (const hit of hits) {
    await query(
      "insert into cross_reference_index (project_id, owner_kind, owner_id, field, reference_kind, reference) values ($1,$2,$3,$4,$5,$6)",
      [projectId, hit.kind, hit.ownerId, hit.field, hit.referenceKind ?? "tag", hit.reference]
    );
  }
  return hits;
}
