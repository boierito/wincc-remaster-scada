import type { FaceplateInstance, FaceplateType, ScreenObject, Tag } from "./model.js";

export interface CrossReferenceHit {
  kind: "screenObject" | "faceplateInstance" | "faceplateType" | "script" | "alarm" | "historianArchive" | "report" | "textList" | "graphicList" | "userArchive" | "tag";
  ownerId: string;
  field: string;
  reference: string;
  referenceKind?: "tag" | "screen" | "script" | "faceplate" | "textList" | "graphicList" | "resource" | "alarm" | "archive";
}

export function findTagReferences(input: {
  tags: Tag[];
  objects: ScreenObject[];
  faceplateInstances: FaceplateInstance[];
  scripts: Array<{ id: string; source: string }>;
}): CrossReferenceHit[] {
  return findCrossReferences(input);
}

export function findCrossReferences(input: {
  tags: Array<Pick<Tag, "path">>;
  screens?: Array<{ id: string; name: string }>;
  objects?: ScreenObject[];
  faceplateTypes?: Array<Pick<FaceplateType, "id" | "name" | "interface" | "composition">>;
  faceplateInstances?: FaceplateInstance[];
  scripts?: Array<{ id: string; name?: string; source: string; trigger?: Record<string, unknown> }>;
  alarms?: Array<{ id: string; sourceTagPath?: string; condition?: unknown; messageTemplate?: string }>;
  historianArchives?: Array<{ id: string; name: string; tagPath?: string }>;
  reports?: Array<{ id: string; name: string; template: unknown }>;
  textItems?: Array<{ id: string; listName: string; key: string; text: string }>;
  graphicItems?: Array<{ id: string; key: string; assetRef: string }>;
  userArchives?: Array<{ id: string; name: string; schema: unknown; rows: unknown }>;
}): CrossReferenceHit[] {
  const tagPaths = input.tags.map((tag) => tag.path);
  const screenNames = (input.screens ?? []).map((screen) => screen.name);
  const hits: CrossReferenceHit[] = [];

  for (const object of input.objects ?? []) {
    for (const [field, reference] of Object.entries(object.bindings)) {
      if (tagPaths.includes(reference)) hits.push({ kind: "screenObject", ownerId: object.id, field, reference, referenceKind: "tag" });
    }
    scanJson(object.properties, (field, reference) => {
      if (tagPaths.includes(reference)) hits.push({ kind: "screenObject", ownerId: object.id, field: `properties.${field}`, reference, referenceKind: "tag" });
      if (screenNames.includes(reference)) hits.push({ kind: "screenObject", ownerId: object.id, field: `properties.${field}`, reference, referenceKind: "screen" });
    });
  }

  for (const instance of input.faceplateInstances ?? []) {
    for (const [field, reference] of Object.entries(instance.tagBindings)) {
      if (tagPaths.includes(reference)) hits.push({ kind: "faceplateInstance", ownerId: instance.id, field, reference, referenceKind: "tag" });
    }
  }

  for (const type of input.faceplateTypes ?? []) {
    scanJson(type.interface, (field, reference) => {
      if (tagPaths.includes(reference)) hits.push({ kind: "faceplateType", ownerId: type.id, field: `interface.${field}`, reference, referenceKind: "tag" });
    });
    scanJson(type.composition, (field, reference) => {
      if (tagPaths.includes(reference)) hits.push({ kind: "faceplateType", ownerId: type.id, field: `composition.${field}`, reference, referenceKind: "tag" });
    });
  }

  for (const script of input.scripts ?? []) {
    for (const path of tagPaths) {
      if (script.source.includes(path)) hits.push({ kind: "script", ownerId: script.id, field: "source", reference: path, referenceKind: "tag" });
    }
    for (const screenName of screenNames) {
      if (script.source.includes(screenName)) hits.push({ kind: "script", ownerId: script.id, field: "source", reference: screenName, referenceKind: "screen" });
    }
    scanJson(script.trigger ?? {}, (field, reference) => {
      if (tagPaths.includes(reference)) hits.push({ kind: "script", ownerId: script.id, field: `trigger.${field}`, reference, referenceKind: "tag" });
    });
  }

  for (const alarm of input.alarms ?? []) {
    if (alarm.sourceTagPath) hits.push({ kind: "alarm", ownerId: alarm.id, field: "sourceTag", reference: alarm.sourceTagPath, referenceKind: "tag" });
  }

  for (const archive of input.historianArchives ?? []) {
    if (archive.tagPath) hits.push({ kind: "historianArchive", ownerId: archive.id, field: "tag", reference: archive.tagPath, referenceKind: "tag" });
  }

  for (const report of input.reports ?? []) {
    scanJson(report.template, (field, reference) => {
      if (tagPaths.includes(reference)) hits.push({ kind: "report", ownerId: report.id, field: `template.${field}`, reference, referenceKind: "tag" });
      if (reference.includes("speed") || reference.includes("archive")) hits.push({ kind: "report", ownerId: report.id, field: `template.${field}`, reference, referenceKind: "archive" });
    });
  }

  for (const item of input.textItems ?? []) {
    hits.push({ kind: "textList", ownerId: item.id, field: "listName", reference: item.listName, referenceKind: "textList" });
  }

  for (const item of input.graphicItems ?? []) {
    hits.push({ kind: "graphicList", ownerId: item.id, field: "assetRef", reference: item.assetRef, referenceKind: "resource" });
  }

  for (const archive of input.userArchives ?? []) {
    scanJson(archive.schema, (field, reference) => hits.push({ kind: "userArchive", ownerId: archive.id, field: `schema.${field}`, reference, referenceKind: "archive" }));
  }

  return hits;
}

function scanJson(value: unknown, onString: (field: string, value: string) => void, path: string[] = []): void {
  if (typeof value === "string") {
    onString(path.join(".") || "value", value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanJson(item, onString, [...path, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) scanJson(nested, onString, [...path, key]);
  }
}
