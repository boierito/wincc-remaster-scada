import type { ScreenObject } from "./model.js";

export type AlignmentMode = "left" | "right" | "top" | "bottom" | "horizontalCenter" | "verticalCenter";

export function alignObjects(objects: ScreenObject[], mode: AlignmentMode): ScreenObject[] {
  if (!objects.length) return [];
  const bounds = {
    left: Math.min(...objects.map((object) => object.x)),
    right: Math.max(...objects.map((object) => object.x + object.width)),
    top: Math.min(...objects.map((object) => object.y)),
    bottom: Math.max(...objects.map((object) => object.y + object.height))
  };
  const centerX = bounds.left + (bounds.right - bounds.left) / 2;
  const centerY = bounds.top + (bounds.bottom - bounds.top) / 2;
  return objects.map((object) => {
    if (mode === "left") return { ...object, x: bounds.left };
    if (mode === "right") return { ...object, x: bounds.right - object.width };
    if (mode === "top") return { ...object, y: bounds.top };
    if (mode === "bottom") return { ...object, y: bounds.bottom - object.height };
    if (mode === "horizontalCenter") return { ...object, x: centerX - object.width / 2 };
    return { ...object, y: centerY - object.height / 2 };
  });
}

export function assignSequentialZ(objects: ScreenObject[], start = 0): ScreenObject[] {
  return [...objects]
    .sort((a, b) => a.zIndex - b.zIndex || a.name.localeCompare(b.name))
    .map((object, index) => ({ ...object, zIndex: start + index }));
}
