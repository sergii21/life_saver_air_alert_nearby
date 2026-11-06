/**
 * Text normalisation + keyword matching tuned for Ukrainian/Russian Telegram posts.
 */

const LETTER = "a-z0-9а-яіїєґё'";

/** Lowercase, unify apostrophes / quotes / dashes, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’ʼ`´‘ʹ′]/g, "'")
    .replace(/ё/g, 'е')
    .replace(/[ \s]+/g, ' ')
    .trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map<string, RegExp>();

/**
 * Build a regex for one keyword.
 *  - "замост*"      → word starting with "замост"
 *  - "старе місто"  → exact phrase as whole words
 *  - "центр міст*"  → phrase whose last word is a prefix
 * Spaces in a keyword match any whitespace / dash / punctuation run.
 */
export function keywordRegex(keyword: string): RegExp {
  const cached = cache.get(keyword);
  if (cached) return cached;
  const kw = normalize(keyword);
  const prefix = kw.endsWith('*');
  const body = (prefix ? kw.slice(0, -1) : kw)
    .split(' ')
    .filter(Boolean)
    .map(escapeRe)
    .join(`[^${LETTER}]+`);
  const tail = prefix ? '' : `(?![${LETTER}])`;
  const re = new RegExp(`(?<![${LETTER}])${body}${tail}`, 'u');
  cache.set(keyword, re);
  return re;
}

/** True if normalized `text` contains any of the keywords. */
export function containsAny(normalizedText: string, keywords: string[]): boolean {
  return keywords.some((k) => keywordRegex(k).test(normalizedText));
}
