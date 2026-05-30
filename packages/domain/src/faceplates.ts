import type { FaceplateInstance, FaceplateType } from "./model.js";

export interface PropagationResult {
  instance: FaceplateInstance;
  missingRequiredBindings: string[];
  removedBindings: string[];
}

export function propagateFaceplateType(instance: FaceplateInstance, nextType: FaceplateType): PropagationResult {
  const allowedTags = new Set(nextType.interface.tags.map((tag) => tag.name));
  const requiredTags = nextType.interface.tags.filter((tag) => tag.required).map((tag) => tag.name);
  const nextBindings = Object.fromEntries(Object.entries(instance.tagBindings).filter(([name]) => allowedTags.has(name)));
  const removedBindings = Object.keys(instance.tagBindings).filter((name) => !allowedTags.has(name));
  const missingRequiredBindings = requiredTags.filter((name) => !nextBindings[name]);

  return {
    instance: {
      ...instance,
      typeVersion: nextType.version,
      tagBindings: nextBindings
    },
    missingRequiredBindings,
    removedBindings
  };
}
