export function slugify(value: string, fallback: string): string {
  const base = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
    cleaned = base.replace(/^-+|-+$/g, '');
  if (cleaned) {
    return cleaned;
  }
  return fallback;
}
