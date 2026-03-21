import { Level, WordPlacement, Direction, GameMode } from '../types/game';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawDict = require('../assets/turkish_dict.json') as Array<{
  madde: string;
  anlamlar?: string[];
}>;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawOxford = require('../assets/oxford_3000.json') as Array<{
  tr: string;
  en: string;
}>;

const TR_VALID = /^[A-ZÇĞİÖŞÜ]+$/;
const EN_VALID = /^[A-Z]+$/;

function turkishUppercase(str: string): string {
  return str
    .replace(/i/g, '\u0130') // i → İ
    .replace(/\u0131/g, 'I') // ı → I
    .replace(/\u011f/g, '\u011e') // ğ → Ğ
    .replace(/\u015f/g, '\u015e') // ş → Ş
    .replace(/\u00e7/g, '\u00c7') // ç → Ç
    .replace(/\u00f6/g, '\u00d6') // ö → Ö
    .replace(/\u00fc/g, '\u00dc') // ü → Ü
    .toUpperCase();
}

// ─── TR dictionary (existing) ─────────────────────────────────────────────────
const TR_MEANINGS = new Map<string, string>();

const TR_WORDS: string[] = (() => {
  const set = new Set<string>();
  for (const entry of rawDict) {
    const cleaned = (entry.madde || '').replace(/\s*\([^)]*\)/g, '').trim();
    if (!cleaned) continue;
    const upper = turkishUppercase(cleaned);
    if (upper.length >= 3 && upper.length <= 7 && TR_VALID.test(upper)) {
      set.add(upper);
      if (entry.anlamlar && entry.anlamlar.length > 0 && !TR_MEANINGS.has(upper)) {
        TR_MEANINGS.set(upper, entry.anlamlar[0]);
      }
    }
  }
  return Array.from(set);
})();

// ─── Oxford EN→TR (English words, Turkish meanings) ──────────────────────────
const EN_TR_MEANINGS = new Map<string, string>(); // EN word → TR meaning

const EN_TR_WORDS: string[] = (() => {
  const set = new Set<string>();
  for (const entry of rawOxford) {
    const en = entry.en.trim().toUpperCase();
    if (en.length >= 3 && en.length <= 7 && EN_VALID.test(en)) {
      set.add(en);
      if (!EN_TR_MEANINGS.has(en)) EN_TR_MEANINGS.set(en, entry.tr);
    }
  }
  return Array.from(set);
})();

// ─── Oxford TR→EN (Turkish words, English meanings) ──────────────────────────
const TR_EN_MEANINGS = new Map<string, string>(); // TR word → EN meaning

const TR_EN_WORDS: string[] = (() => {
  const set = new Set<string>();
  for (const entry of rawOxford) {
    const cleaned = entry.tr.replace(/\s*\([^)]*\)/g, '').trim();
    if (!cleaned || cleaned.includes(' ')) continue;
    const upper = turkishUppercase(cleaned);
    if (upper.length >= 3 && upper.length <= 7 && TR_VALID.test(upper)) {
      set.add(upper);
      if (!TR_EN_MEANINGS.has(upper)) TR_EN_MEANINGS.set(upper, entry.en);
    }
  }
  return Array.from(set);
})();

// ─── Difficulty config ────────────────────────────────────────────────────────

interface DifficultyConfig {
  seedMinLen: number;
  seedMaxLen: number;
  wordMinLen: number;
  wordMaxLen: number;
  minWords: number;
  maxWords: number;
}

function getDifficulty(levelNum: number): DifficultyConfig {
  if (levelNum <= 3)
    return { seedMinLen: 3, seedMaxLen: 4, wordMinLen: 3, wordMaxLen: 4, minWords: 3, maxWords: 4 };
  if (levelNum <= 7)
    return { seedMinLen: 4, seedMaxLen: 4, wordMinLen: 3, wordMaxLen: 5, minWords: 3, maxWords: 5 };
  if (levelNum <= 15)
    return { seedMinLen: 4, seedMaxLen: 5, wordMinLen: 4, wordMaxLen: 5, minWords: 4, maxWords: 5 };
  if (levelNum <= 25)
    return { seedMinLen: 5, seedMaxLen: 6, wordMinLen: 4, wordMaxLen: 6, minWords: 4, maxWords: 6 };
  return { seedMinLen: 5, seedMaxLen: 7, wordMinLen: 5, wordMaxLen: 7, minWords: 4, maxWords: 6 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canFormWord(word: string, letterCounts: Map<string, number>): boolean {
  const needed = new Map<string, number>();
  for (const ch of word) needed.set(ch, (needed.get(ch) ?? 0) + 1);
  for (const [ch, count] of needed) {
    if ((letterCounts.get(ch) ?? 0) < count) return false;
  }
  return true;
}

function computeLetterPool(words: string[]): string[] {
  const maxFreq = new Map<string, number>();
  for (const word of words) {
    const freq = new Map<string, number>();
    for (const ch of word) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    for (const [ch, count] of freq) {
      if ((maxFreq.get(ch) ?? 0) < count) maxFreq.set(ch, count);
    }
  }
  const letters: string[] = [];
  for (const [ch, count] of maxFreq) {
    for (let i = 0; i < count; i++) letters.push(ch);
  }
  return letters;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Crossword builder ────────────────────────────────────────────────────────

function isValidPlacement(
  word: string,
  startR: number,
  startC: number,
  dir: Direction,
  grid: Map<string, string>,
): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = dir === 'H' ? startR : startR + i;
    const c = dir === 'H' ? startC + i : startC;
    const existing = grid.get(`${r},${c}`);
    if (existing !== undefined && existing !== word[i]) return false;
  }

  if (dir === 'H') {
    if (grid.has(`${startR},${startC - 1}`)) return false;
    if (grid.has(`${startR},${startC + word.length}`)) return false;
  } else {
    if (grid.has(`${startR - 1},${startC}`)) return false;
    if (grid.has(`${startR + word.length},${startC}`)) return false;
  }

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'H' ? startR : startR + i;
    const c = dir === 'H' ? startC + i : startC;
    if (!grid.has(`${r},${c}`)) {
      if (dir === 'H') {
        if (grid.has(`${r - 1},${c}`) || grid.has(`${r + 1},${c}`)) return false;
      } else {
        if (grid.has(`${r},${c - 1}`) || grid.has(`${r},${c + 1}`)) return false;
      }
    }
  }
  return true;
}

interface CrosswordResult {
  placements: WordPlacement[];
  rows: number;
  cols: number;
}

function buildCrossword(words: string[]): CrosswordResult | null {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const grid = new Map<string, string>();
  const placements: WordPlacement[] = [];

  const first = sorted[0];
  placements.push({ word: first, row: 0, col: 0, dir: 'H' });
  for (let i = 0; i < first.length; i++) grid.set(`0,${i}`, first[i]);

  for (let w = 1; w < sorted.length; w++) {
    const word = sorted[w];
    let placed = false;

    for (let pw = 0; pw < placements.length && !placed; pw++) {
      const pp = placements[pw];
      const newDir: Direction = pp.dir === 'H' ? 'V' : 'H';

      for (let wIdx = 0; wIdx < word.length && !placed; wIdx++) {
        for (let pIdx = 0; pIdx < pp.word.length && !placed; pIdx++) {
          if (word[wIdx] !== pp.word[pIdx]) continue;

          const crossR = pp.dir === 'H' ? pp.row : pp.row + pIdx;
          const crossC = pp.dir === 'H' ? pp.col + pIdx : pp.col;
          const startR = newDir === 'H' ? crossR : crossR - wIdx;
          const startC = newDir === 'H' ? crossC - wIdx : crossC;

          if (isValidPlacement(word, startR, startC, newDir, grid)) {
            placements.push({ word, row: startR, col: startC, dir: newDir });
            for (let k = 0; k < word.length; k++) {
              const r = newDir === 'H' ? startR : startR + k;
              const c = newDir === 'H' ? startC + k : startC;
              grid.set(`${r},${c}`, word[k]);
            }
            placed = true;
          }
        }
      }
    }

    if (!placed) return null;
  }

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const key of grid.keys()) {
    const [r, c] = key.split(',').map(Number);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  if (rows > 12 || cols > 12) return null;

  return {
    placements: placements.map(p => ({
      word: p.word,
      row: p.row - minR,
      col: p.col - minC,
      dir: p.dir,
    })),
    rows,
    cols,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateLevel(
  levelNum: number,
  mode: GameMode = 'TR',
  excludeWords?: Set<string>,
): Level {
  const allWords = mode === 'EN_TR' ? EN_TR_WORDS : mode === 'TR_EN' ? TR_EN_WORDS : TR_WORDS;
  const meaningsMap = mode === 'EN_TR' ? EN_TR_MEANINGS : mode === 'TR_EN' ? TR_EN_MEANINGS : TR_MEANINGS;

  const config = getDifficulty(levelNum);
  const seedPool = allWords.filter(
    w => w.length >= config.seedMinLen && w.length <= config.seedMaxLen,
  );

  for (let attempt = 0; attempt < 3000; attempt++) {
    const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
    const uniqueLetters = [...new Set(seed.split(''))];
    if (uniqueLetters.length < 3 || uniqueLetters.length > 8) continue;

    const letterCounts = new Map<string, number>();
    for (const ch of seed) letterCounts.set(ch, (letterCounts.get(ch) ?? 0) + 1);

    const formable = allWords.filter(
      w =>
        w.length >= config.wordMinLen &&
        w.length <= config.wordMaxLen &&
        canFormWord(w, letterCounts) &&
        (!excludeWords || !excludeWords.has(w)),
    );

    if (formable.length < config.minWords || formable.length > 50) continue;

    for (let combo = 0; combo < 8; combo++) {
      const candidates = shuffle(formable).slice(0, 12);
      let current = [candidates[0]];

      for (let i = 1; i < candidates.length && current.length < config.maxWords; i++) {
        if (buildCrossword([...current, candidates[i]])) {
          current = [...current, candidates[i]];
        }
      }

      if (current.length < config.minWords) continue;

      const result = buildCrossword(current);
      if (!result) continue;

      const orderedWords = result.placements.map(p => p.word);
      const meanings: Record<string, string> = {};
      for (const w of orderedWords) {
        meanings[w] = meaningsMap.get(w) ?? '';
      }
      return {
        level: levelNum,
        letters: computeLetterPool(orderedWords),
        words: orderedWords,
        meanings,
        placements: result.placements,
        gridRows: result.rows,
        gridCols: result.cols,
      };
    }
  }

  // Fallback: drop difficulty by one level and retry
  return generateLevel(Math.max(1, levelNum - 1), mode, excludeWords);
}
