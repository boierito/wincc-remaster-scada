export interface PrefixContext {
  inheritedPrefix?: string;
  localPrefix?: string;
}

export function resolveTagReference(reference: string, context: PrefixContext = {}): string {
  if (!reference.trim()) return reference;
  if (reference.startsWith("@NOTP::")) return reference.slice("@NOTP::".length);
  if (reference.startsWith("@PREFIX::")) {
    const prefix = context.localPrefix ?? context.inheritedPrefix ?? "";
    return joinPrefix(prefix, reference.slice("@PREFIX::".length));
  }
  if (reference.includes("::")) return reference;
  const prefix = context.localPrefix ?? context.inheritedPrefix;
  return prefix ? joinPrefix(prefix, reference) : reference;
}

export function joinPrefix(prefix: string, tag: string): string {
  const cleanPrefix = prefix.replace(/[.:]+$/g, "");
  const cleanTag = tag.replace(/^[.:]+/g, "");
  return cleanPrefix ? `${cleanPrefix}.${cleanTag}` : cleanTag;
}
