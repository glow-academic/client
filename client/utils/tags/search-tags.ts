/**
 * search-tags.ts
 * Reusable tag searching utility with fuzzy-ish matching.
 */

/**
 * Returns tags that best match a query using simple scoring.
 * - exact prefix matches first
 * - includes matches next
 * - case-insensitive
 */
export function searchTags(
  query: string,
  allTags: string[],
  limit: number = 20,
): string[] {
  const q = query.trim().toLowerCase();
  const unique = Array.from(new Set(allTags.filter(Boolean)));
  if (!q) return unique.slice(0, limit);

  const scored = unique.map((tag) => {
    const t = tag.toLowerCase();
    let score = 0;
    if (t === q) score += 4;
    if (t.startsWith(q)) score += 3;
    if (t.includes(q)) score += 1;
    return { tag, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .slice(0, limit)
    .map((s) => s.tag);
}

/**
 * Extracts all known tags from a list of documents (string arrays), flattened and deduped.
 */
export function extractKnownTagsFromDocuments(
  documents: { tags?: string[] }[],
): string[] {
  const tags = documents.flatMap((d) => d.tags ?? []);
  return Array.from(new Set(tags.filter(Boolean)));
}
