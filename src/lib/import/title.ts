// Document title from an uploaded filename

const FALLBACK = "Imported document";
const MAX_LENGTH = 120;

export function titleFromFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const withoutExt = dot > 0 ? base.slice(0, dot) : base;
  const title = withoutExt.replace(/_/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH).trim();
  return title || FALLBACK;
}
