#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '../src/assets/turkish_dict.json');
const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

function turkishUppercase(str) {
  return str
    .replace(/i/g, '\u0130') // i -> İ
    .replace(/\u0131/g, 'I') // ı -> I
    .replace(/\u011f/g, '\u011e') // ğ -> Ğ
    .replace(/\u015f/g, '\u015e') // ş -> Ş
    .replace(/\u00e7/g, '\u00c7') // ç -> Ç
    .replace(/\u00f6/g, '\u00d6') // ö -> Ö
    .replace(/\u00fc/g, '\u00dc') // ü -> Ü
    .toUpperCase();
}

const VALID = /^[A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dc]+$/; // A-Z + Ç Ğ İ Ö Ş Ü

// Build word list from dictionary
const wordSet = new Set();
for (const entry of rawDict) {
  const madde = (entry.madde || '');
  // Strip parenthetical suffixes like "(I)", "(II)"
  const cleaned = madde.replace(/\s*\([^)]*\)/g, '').trim();
  if (!cleaned) continue;
  const upper = turkishUppercase(cleaned);
  if (upper.length >= 3 && upper.length <= 7 && VALID.test(upper)) {
    wordSet.add(upper);
  }
}

const allWords = Array.from(wordSet);
console.log(`Total valid words: ${allWords.length}`);

function canFormWord(word, letterSet) {
  for (const ch of word) {
    if (!letterSet.has(ch)) return false;
  }
  return true;
}

// Compute the letter pool for the wheel:
// for each letter, include it as many times as it appears in the word that uses it most.
function computeLetterPool(words) {
  const maxFreq = new Map();
  for (const word of words) {
    const freq = new Map();
    for (const ch of word) {
      freq.set(ch, (freq.get(ch) || 0) + 1);
    }
    for (const [ch, count] of freq) {
      if (!maxFreq.has(ch) || maxFreq.get(ch) < count) {
        maxFreq.set(ch, count);
      }
    }
  }
  const letters = [];
  for (const [ch, count] of maxFreq) {
    for (let i = 0; i < count; i++) letters.push(ch);
  }
  return letters;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValidPlacement(word, startR, startC, dir, grid) {
  // Check each cell of the word
  for (let i = 0; i < word.length; i++) {
    const r = dir === 'H' ? startR : startR + i;
    const c = dir === 'H' ? startC + i : startC;
    const key = `${r},${c}`;
    const existing = grid.get(key);
    if (existing !== undefined && existing !== word[i]) return false; // letter conflict
  }

  // Check word start/end boundaries (no letter immediately before or after)
  if (dir === 'H') {
    if (grid.has(`${startR},${startC - 1}`)) return false;
    if (grid.has(`${startR},${startC + word.length}`)) return false;
  } else {
    if (grid.has(`${startR - 1},${startC}`)) return false;
    if (grid.has(`${startR + word.length},${startC}`)) return false;
  }

  // Check perpendicular neighbors for new (non-crossing) cells
  for (let i = 0; i < word.length; i++) {
    const r = dir === 'H' ? startR : startR + i;
    const c = dir === 'H' ? startC + i : startC;
    const key = `${r},${c}`;
    if (!grid.has(key)) {
      if (dir === 'H') {
        if (grid.has(`${r - 1},${c}`) || grid.has(`${r + 1},${c}`)) return false;
      } else {
        if (grid.has(`${r},${c - 1}`) || grid.has(`${r},${c + 1}`)) return false;
      }
    }
  }

  return true;
}

function buildCrossword(words) {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const grid = new Map(); // "row,col" -> letter
  const placements = [];

  // Place first word horizontally at origin
  const first = sorted[0];
  placements.push({ word: first, row: 0, col: 0, dir: 'H' });
  for (let i = 0; i < first.length; i++) {
    grid.set(`0,${i}`, first[i]);
  }

  for (let w = 1; w < sorted.length; w++) {
    const word = sorted[w];
    let placed = false;

    for (let pw = 0; pw < placements.length && !placed; pw++) {
      const pp = placements[pw];
      const newDir = pp.dir === 'H' ? 'V' : 'H';

      for (let wIdx = 0; wIdx < word.length && !placed; wIdx++) {
        for (let pIdx = 0; pIdx < pp.word.length && !placed; pIdx++) {
          if (word[wIdx] !== pp.word[pIdx]) continue;

          // Compute the crossing cell position
          const crossR = pp.dir === 'H' ? pp.row : pp.row + pIdx;
          const crossC = pp.dir === 'H' ? pp.col + pIdx : pp.col;

          // Compute new word start
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

  // Normalize: offset all coords so min row/col = 0
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

  const normalizedPlacements = placements.map(p => ({
    word: p.word,
    row: p.row - minR,
    col: p.col - minC,
    dir: p.dir,
  }));

  return { placements: normalizedPlacements, rows, cols };
}

function generateLevel(levelNum, usedLetterSets) {
  const seedPool = allWords.filter(w => w.length >= 4 && w.length <= 6);

  for (let attempt = 0; attempt < 3000; attempt++) {
    const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
    const uniqueLetters = [...new Set(seed.split(''))];

    if (uniqueLetters.length < 3 || uniqueLetters.length > 8) continue;

    const setKey = [...uniqueLetters].sort().join(',');
    if (usedLetterSets.has(setKey)) continue;

    const letterSet = new Set(uniqueLetters);
    const formable = allWords.filter(w => canFormWord(w, letterSet) && w.length >= 3);

    if (formable.length < 3 || formable.length > 40) continue;

    // Try a few random orderings to build a crossword with 3–6 words
    for (let combo = 0; combo < 8; combo++) {
      const candidates = shuffle(formable).slice(0, 12);
      let current = [candidates[0]];

      for (let i = 1; i < candidates.length && current.length < 6; i++) {
        const test = [...current, candidates[i]];
        if (buildCrossword(test)) {
          current = test;
        }
      }

      if (current.length < 3) continue;

      const result = buildCrossword(current);
      if (!result) continue;

      usedLetterSets.add(setKey);
      // Keep words in the same order as placements so words[i] === placements[i].word
      const orderedWords = result.placements.map(p => p.word);
      return {
        level: levelNum,
        letters: computeLetterPool(orderedWords),
        words: orderedWords,
        placements: result.placements,
        gridRows: result.rows,
        gridCols: result.cols,
      };
    }
  }

  return null;
}

// Generate 60 levels
const levels = [];
const usedLetterSets = new Set();
let nextLevel = 1;
let failures = 0;

while (levels.length < 60 && failures < 20) {
  const level = generateLevel(nextLevel, usedLetterSets);
  if (level) {
    levels.push(level);
    process.stdout.write(`Level ${nextLevel}: ${level.words.join(', ')} [${level.letters.join('')}]\n`);
    nextLevel++;
    failures = 0;
  } else {
    process.stdout.write(`Failed to generate level ${nextLevel}, retrying...\n`);
    failures++;
  }
}

console.log(`\nGenerated ${levels.length} levels`);

// Write output
const outDir = path.join(__dirname, '../src/data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const tsContent = `// Auto-generated file — do not edit manually. Run: node scripts/generateLevels.js
import { Level } from '../types/game';

export const LEVELS: Level[] = ${JSON.stringify(levels, null, 2)};
`;

fs.writeFileSync(path.join(outDir, 'levels.ts'), tsContent, 'utf8');
console.log('Written to src/data/levels.ts');
