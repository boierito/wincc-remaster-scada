export interface ScriptRuntimeApi {
  readTag(path: string): unknown;
  writeTag(path: string, value: unknown): void | Promise<void>;
  openPicture(name: string, tagPrefix?: string): void;
  acknowledgeAlarm(eventId: string): void | Promise<void>;
}

export function translateWinccLikeScript(source: string): string {
  return source
    .replace(/\bHMIRuntime\.Tags\("([^"]+)"\)\.Read\(\)/g, 'api.readTag("$1")')
    .replace(/\bHMIRuntime\.Tags\("([^"]+)"\)\.Write\(([^)]+)\)/g, 'api.writeTag("$1", $2)')
    .replace(/\bOpenPicture\("([^"]+)"(?:,\s*"([^"]+)")?\)/g, (_match, picture: string, prefix?: string) =>
      prefix ? `api.openPicture("${picture}", "${prefix}")` : `api.openPicture("${picture}")`
    );
}
