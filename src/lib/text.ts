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
 *  - "немирівськ* шосе" → any word of a phrase can be a prefix
 * Spaces in a keyword match any whitespace / dash / punctuation run.
 */
export function keywordRegex(keyword: string): RegExp {
  const cached = cache.get(keyword);
  if (cached) return cached;
  // Each word may end with "*" (prefix): "немирівськ* шосе" matches "Немирівському шосе".
  const words = normalize(keyword).split(' ').filter(Boolean);
  const body = words
    .map((w, i) => {
      const prefix = w.endsWith('*');
      const stem = escapeRe(prefix ? w.slice(0, -1) : w);
      if (!prefix) return stem;
      // A prefix word inside a phrase must be completed before the next word starts.
      return i < words.length - 1 ? `${stem}[${LETTER}]*` : stem;
    })
    .join(`[^${LETTER}]+`);
  const tail = words.length > 0 && words[words.length - 1].endsWith('*') ? '' : `(?![${LETTER}])`;
  const re = new RegExp(`(?<![${LETTER}])${body}${tail}`, 'u');
  cache.set(keyword, re);
  return re;
}

/** True if normalized `text` contains any of the keywords. */
export function containsAny(normalizedText: string, keywords: string[]): boolean {
  return keywords.some((k) => keywordRegex(k).test(normalizedText));
}
