/**
 * Spoken advice. Uses the phone's own text-to-speech voices (no recordings, works offline).
 * Which voices exist depends on the phone: iPhone ships one Ukrainian voice (Lesya, a woman)
 * and several English ones; more can be downloaded in the phone's Accessibility settings.
 */
import * as Speech from 'expo-speech';

export interface VoiceOption {
  id: string;
  name: string;
  /** Guessed from the voice's name; null when unknown. */
  gender: 'f' | 'm' | null;
}

const LOCALE = { uk: 'uk-UA', en: 'en-US' } as const;

const WOMEN = ['lesya', 'samantha', 'karen', 'moira', 'tessa', 'kate', 'serena', 'martha', 'catherine', 'nicky', 'allison', 'ava', 'susan', 'zoe', 'victoria', 'fiona', 'stephanie', 'isha', 'female'];
const MEN = ['daniel', 'aaron', 'arthur', 'gordon', 'rishi', 'fred', 'alex', 'tom', 'oliver', 'evan', 'nathan', 'lee', 'reed', 'eddy', 'rocko', 'male'];

function guessGender(name: string): 'f' | 'm' | null {
  const n = name.toLowerCase();
  if (WOMEN.some((w) => n.includes(w))) return 'f';
  if (MEN.some((m) => n.split(/[^a-z]+/).includes(m))) return 'm';
  return null;
}

/** Voices installed on this phone for the language. Best quality first; at most 8. */
export async function listVoices(lang: 'uk' | 'en'): Promise<VoiceOption[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const seen = new Set<string>();
    return all
      .filter((v) => v.language?.toLowerCase().startsWith(lang))
      .sort((a, b) => (a.quality === b.quality ? 0 : a.quality === Speech.VoiceQuality.Enhanced ? -1 : 1))
      .filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)))
      .slice(0, 8)
      .map((v) => ({ id: v.identifier, name: v.name, gender: guessGender(v.name) }));
  } catch {
    return [];
  }
}

export function speak(text: string, opts: { lang: 'uk' | 'en'; voiceId?: string | null; onEnd?: () => void }): void {
  const end = () => opts.onEnd?.();
  try {
    Speech.stop();
    Speech.speak(text, {
      language: LOCALE[opts.lang],
      voice: opts.voiceId ?? undefined,
      rate: 0.95,
      onDone: end,
      onStopped: end,
      onError: end,
    });
  } catch {
    end();
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // nothing was speaking
  }
}
