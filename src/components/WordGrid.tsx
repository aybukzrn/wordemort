import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Level } from '../types/game';
import { useScale } from '../utils/useScale';

const GRID_H_PADDING = 40;

interface CellData {
  row: number;
  col: number;
  letter: string;
  revealed: boolean;
  word: string;
  anim: Animated.Value;
}

interface Props {
  level: Level;
  foundWords: boolean[];
  onWordPress?: (word: string, isRevealed: boolean) => void;
  highlightedWord?: string;
}

export function WordGrid({ level, foundWords, onWordPress, highlightedWord }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const s = useScale();

  const cellSize = Math.round(36 * s);
  const cellGap = Math.round(3 * s);
  const cellStep = cellSize + cellGap;

  // Animated value cache: `${row},${col}` → Animated.Value
  // Keyed by level so changing levels never reuses stale values.
  const animCache = useRef<{ levelNum: number; map: Map<string, Animated.Value> }>({
    levelNum: -1,
    map: new Map(),
  });

  // Shared scale anim for all highlighted cells — pops when a word is highlighted
  const highlightScaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (highlightedWord) {
      Animated.sequence([
        Animated.timing(highlightScaleAnim, { toValue: 1.12, duration: 100, useNativeDriver: true }),
        Animated.spring(highlightScaleAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    } else {
      highlightScaleAnim.setValue(1);
    }
  }, [highlightedWord, highlightScaleAnim]);

  // Track previous foundWords to detect newly revealed words
  const prevFoundRef = useRef<boolean[]>([]);

  const naturalWidth = level.gridCols * cellStep - cellGap;
  const available = screenWidth - GRID_H_PADDING;
  const gridScale = naturalWidth > available ? available / naturalWidth : 1;

  // ─── Build cell list ────────────────────────────────────────────────────────
  const cells = useMemo((): CellData[] => {
    // Reset cache when level changes
    if (animCache.current.levelNum !== level.level) {
      animCache.current = { levelNum: level.level, map: new Map() };
      prevFoundRef.current = level.words.map(() => false);
    }

    const map = new Map<string, { letter: string; revealed: boolean; word: string }>();

    level.placements.forEach(placement => {
      const wIdx = level.words.indexOf(placement.word);
      const isFound = wIdx >= 0 && foundWords[wIdx];
      for (let i = 0; i < placement.word.length; i++) {
        const r = placement.dir === 'H' ? placement.row : placement.row + i;
        const c = placement.dir === 'H' ? placement.col + i : placement.col;
        const key = `${r},${c}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { letter: placement.word[i], revealed: isFound, word: placement.word });
        } else if (isFound && !existing.revealed) {
          map.set(key, { ...existing, revealed: true });
        }
      }
    });

    return Array.from(map.entries()).map(([key, data]) => {
      const [row, col] = key.split(',').map(Number);
      let anim = animCache.current.map.get(key);
      if (!anim) {
        anim = new Animated.Value(data.revealed ? 1 : 0);
        animCache.current.map.set(key, anim);
      }
      return { row, col, ...data, anim };
    });
  }, [level, foundWords]);

  // ─── Animate newly revealed cells ──────────────────────────────────────────
  useEffect(() => {
    const prev = prevFoundRef.current;
    const newKeys: string[] = [];

    level.placements.forEach(placement => {
      const wIdx = level.words.indexOf(placement.word);
      if (wIdx >= 0 && foundWords[wIdx] && !prev[wIdx]) {
        for (let i = 0; i < placement.word.length; i++) {
          const r = placement.dir === 'H' ? placement.row : placement.row + i;
          const c = placement.dir === 'H' ? placement.col + i : placement.col;
          newKeys.push(`${r},${c}`);
        }
      }
    });

    prevFoundRef.current = [...foundWords];

    newKeys.forEach((key, i) => {
      const anim = animCache.current.map.get(key);
      if (!anim) return;
      setTimeout(() => {
        anim.setValue(0);
        Animated.spring(anim, {
          toValue: 1,
          friction: 5,
          tension: 200,
          useNativeDriver: true,
        }).start();
      }, i * 75);
    });
  }, [foundWords, level]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const gridWidth = level.gridCols * cellStep - cellGap;
  const gridHeight = level.gridRows * cellStep - cellGap;

  return (
    <View
      style={[
        styles.grid,
        {
          width: gridWidth,
          height: gridHeight,
          transform: [{ scale: gridScale }],
          marginBottom: gridHeight * (gridScale - 1),
        },
      ]}>
      {cells.map(cell => {
        const letterScale = cell.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
          extrapolate: 'clamp',
        });
        const letterOpacity = cell.anim.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        });

        const isHighlighted = !!highlightedWord && cell.word === highlightedWord;

        return (
          <TouchableOpacity
            key={`${cell.row},${cell.col}`}
            activeOpacity={0.65}
            onPress={() => onWordPress?.(cell.word, cell.revealed)}
            style={[
              styles.cellWrapper,
              {
                left: cell.col * cellStep,
                top: cell.row * cellStep,
                width: cellSize,
                height: cellSize,
              },
            ]}>
            <Animated.View
              style={[
                styles.cell,
                {
                  borderRadius: Math.round(6 * s),
                  backgroundColor: isHighlighted ? '#f0c040' : 'rgba(255,255,255,0.92)',
                  transform: [{ scale: isHighlighted ? highlightScaleAnim : 1 }],
                },
              ]}>
              {cell.revealed && (
                <Animated.Text
                  style={[
                    styles.cellLetter,
                    isHighlighted && styles.cellLetterHighlighted,
                    {
                      fontSize: Math.round(18 * s),
                      opacity: letterOpacity,
                      transform: [{ scale: letterScale }],
                    },
                  ]}>
                  {cell.letter}
                </Animated.Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    position: 'relative',
  },
  cellWrapper: {
    position: 'absolute',
  },
  cell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  cellLetter: {
    color: '#1a3a6b',
    fontWeight: '700',
  },
  cellLetterHighlighted: {
    color: '#5a3800',
  },
});
