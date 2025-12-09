export function normalizeFolder(folder?: string): string {
  if (!folder) return '';
  return folder.replace(/\\+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').trim();
}

export function buildRepoPath(folder: string | undefined, filename: string): string {
  const normalizedFolder = normalizeFolder(folder);
  return normalizedFolder ? `${normalizedFolder}/${filename}` : filename;
}
