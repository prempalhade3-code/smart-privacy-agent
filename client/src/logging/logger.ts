export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const prefix = `[VDLM:${level}]`;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  switch (level) {
    case "debug":
      console.debug(prefix, message + suffix);
      break;
    case "info":
      console.info(prefix, message + suffix);
      break;
    case "warn":
      console.warn(prefix, message + suffix);
      break;
    case "error":
      console.error(prefix, message + suffix);
      break;
  }
}
