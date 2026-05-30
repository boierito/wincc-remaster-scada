import { z } from "zod";

export const idSchema = z.string().uuid();

export const tagDataTypes = [
  "bool",
  "int16",
  "int32",
  "float32",
  "float64",
  "string",
  "datetime",
  "struct",
  "udt"
] as const;

export const tagQualityStates = ["good", "uncertain", "bad", "stale", "disabled"] as const;
export const connectionStates = ["online", "degraded", "offline", "disabled"] as const;

export const tagSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1),
  path: z.string().min(1),
  dataType: z.enum(tagDataTypes),
  scope: z.enum(["internal", "external", "system"]),
  connectionId: idSchema.optional().nullable(),
  address: z.string().optional().nullable(),
  udtTypeId: idSchema.optional().nullable(),
  properties: z.record(z.unknown()).default({})
});

export const tagSampleSchema = z.object({
  tagId: idSchema,
  path: z.string(),
  value: z.unknown(),
  quality: z.enum(tagQualityStates),
  timestamp: z.string().datetime(),
  source: z.string(),
  connectionState: z.enum(connectionStates)
});

export const screenObjectSchema = z.object({
  id: idSchema,
  screenId: idSchema,
  type: z.enum(["rect", "ellipse", "text", "line", "image", "trend", "alarmTable", "faceplate", "pictureWindow"]),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  zIndex: z.number().int().default(0),
  properties: z.record(z.unknown()).default({}),
  bindings: z.record(z.string()).default({}),
  events: z.record(z.string()).default({})
});

export const faceplateTypeSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1),
  version: z.number().int().positive(),
  interface: z.object({
    tags: z.array(z.object({ name: z.string(), dataType: z.enum(tagDataTypes), required: z.boolean().default(true) })),
    properties: z.array(z.object({ name: z.string(), dataType: z.string(), defaultValue: z.unknown().optional() })),
    commands: z.array(z.object({ name: z.string(), scriptId: idSchema.optional() })).default([]),
    events: z.array(z.object({ name: z.string(), scriptId: idSchema.optional() })).default([])
  }),
  composition: z.array(screenObjectSchema.omit({ screenId: true })).default([])
});

export const faceplateInstanceSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  typeId: idSchema,
  typeVersion: z.number().int().positive(),
  name: z.string().min(1),
  tagBindings: z.record(z.string()).default({}),
  propertyOverrides: z.record(z.unknown()).default({}),
  eventOverrides: z.record(z.string()).default({})
});

export type Tag = z.infer<typeof tagSchema>;
export type TagSample = z.infer<typeof tagSampleSchema>;
export type ScreenObject = z.infer<typeof screenObjectSchema>;
export type FaceplateType = z.infer<typeof faceplateTypeSchema>;
export type FaceplateInstance = z.infer<typeof faceplateInstanceSchema>;

export interface ProjectTreeNode {
  id: string;
  label: string;
  kind: "project" | "folder" | "screen" | "tag" | "script" | "faceplate" | "alarm" | "historian" | "user" | "list";
  children?: ProjectTreeNode[];
}
