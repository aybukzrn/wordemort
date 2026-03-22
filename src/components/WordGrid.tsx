import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Level, WordPlacement } from '../types/game';
import { useScale } from '../utils/useScale';

export interface WordGridRef {
  getCellCentersAbsolute: (
    placement: WordPlacement,
    callback: (centers: Array<{ x: number; y: number; size: number }>) => void,
  ) => void;
}

const GRID_H_PADDING = 40;

interface CellData {
  row: number;
  col: number;
  letter: string;
  revealed: boolean;
  word: string;
  anim: Animated.Value;
  entranceAnim: Animated.Value;
}

interface Props {
  level: Level;
  foundWords: boolean[];
  hintedCells?: Set<string>;
  onWordPress?: (word: string, isRevealed: boolean) => void;
  highlightedWord?: string;
  containerWidth?: number;
  containerHeight?: number;
}

export const WordGrid = forwardRef<WordGridRef, Props>(function WordGrid(
  { level, foundWords, hintedCells, onWordPress, highlightedWord, containerWidth, containerHeight },
  ref,
) {
  const { width: screenWidth } = useWindowDimensions();
  const s = useScale();

  const cellSize = Math.round(36 * s);
  const cellGap = Math.round(3 * s);
  const cellStep = cellSize + cellGap;

  // Animated value cache keyed by level — both word-reveal and entrance anims
  const animCache = useRef<{
    levelNum: number;
    map: Map<string, Animated.Value>;
    entranceMap: Map<string, Animated.Value>;
  }>({ levelNum: -1, map: new Map(), entranceMap: new Map() });

  // Shared scale anim for all highlighted cells
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

  const { height: screenHeight } = useWindowDimensions();

  const naturalWidth = level.gridCols * cellStep - cellGap;
  const naturalHeight = level.gridRows * cellStep - cellGap;
  const availableWidth = (containerWidth ?? screenWidth) - GRID_H_PADDING;
  const availableHeight = containerHeight ?? Math.round(screenHeight * 0.40);
  const scaleByWidth = naturalWidth > availableWidth ? availableWidth / naturalWidth : 1;
  const scaleByHeight = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
  const gridScale = Math.min(scaleByWidth, scaleByHeight);

  const gridViewRef = useRef<View>(null);
  const cellSizeRef = useRef(cellSize);
  cellSizeRef.current = cellSize;
  const cellStepRef = useRef(cellStep);
  cellStepRef.current = cellStep;
  const gridScaleRef = useRef(gridScale);
  gridScaleRef.current = gridScale;

  useImperativeHandle(ref, () => ({
    getCellCentersAbsolute: (placement, callback) => {
      const view = gridViewRef.current;
      if (!view) { callback([]); return; }
      view.measureInWindow((gx, gy) => {
        const cs = cellSizeRef.current;
        const step = cellStepRef.current;
        const scale = gridScaleRef.current;
        const centers: Array<{ x: number; y: number; size: number }> = [];
        for (let i = 0; i < placement.word.length; i++) {
          const row = placement.dir === 'H' ? placement.row : placement.row + i;
          const col = placement.dir === 'H' ? placement.col + i : placement.col;
          centers.push({
            x: gx + (col * step + cs / 2) * scale,
            y: gy + (row * step + cs / 2) * scale,
            size: cs * scale,
          });
        }
        callback(centers);
      });
    },
  }));


  // ─── Build cell list ────────────────────────────────────────────────────────
  const cells = useMemo((): CellData[] => {
    if (animCache.current.levelNum !== level.level) {
      animCache.current = { levelNum: level.level, map: new Map(), entranceMap: new Map() };
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

      let entranceAnim = animCache.current.entranceMap.get(key);
      if (!entranceAnim) {
        entranceAnim = new Animated.Value(0);
        animCache.current.entranceMap.set(key, entranceAnim);
      }

      return { row, col, ...data, anim, entranceAnim };
    });
  }, [level, foundWords]);

  // ─── Level entrance animation (diagonal sweep) ──────────────────────────────
  useEffect(() => {
    const entries = Array.from(animCache.current.entranceMap.entries());
    // Sort by diagonal index (row + col) → top-left to bottom-right sweep
    entries.sort(([a], [b]) => {
      const [ar, ac] = a.split(',').map(Number);
      const [br, bc] = b.split(',').map(Number);
      return (ar + ac) - (br + bc);
    });
    entries.forEach(([, anim], i) => {
      anim.setValue(0);
      setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 7,
          tension: 200,
          useNativeDriver: true,
        }).start();
      }, i * 35);
    });
  }, [level.level]);

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

  // ─── Animate newly hinted cells ─────────────────────────────────────────────
  const prevHintedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hintedCells) return;
    hintedCells.forEach(key => {
      if (prevHintedRef.current.has(key)) return;
      const anim = animCache.current.map.get(key);
      if (!anim) return;
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }).start();
    });
    prevHintedRef.current = new Set(hintedCells);
  }, [hintedCells]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const gridWidth = level.gridCols * cellStep - cellGap;
  const gridHeight = level.gridRows * cellStep - cellGap;

  return (
    <View
      ref={gridViewRef}
      style={[
        styles.grid,
        {
          width: gridWidth,
          height: gridHeight,
          transform: [{ scale: gridScale }],
          marginBottom: Math.round(gridHeight * (gridScale - 1)),
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

        // Entrance: scale from 0.3→1 (spring overshoots to ~1.1 for pop feel)
        const entranceScale = cell.entranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        });
        const entranceOpacity = cell.entranceAnim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 1],
          extrapolate: 'clamp',
        });

        const cellKey = `${cell.row},${cell.col}`;
        const isHinted = !cell.revealed && (hintedCells?.has(cellKey) ?? false);
        const showLetter = cell.revealed || isHinted;
        const isHighlighted = !!highlightedWord && cell.word === highlightedWord;

        return (
          <TouchableOpacity
            key={cellKey}
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
                  opacity: entranceOpacity,
                  transform: [
                    { scale: entranceScale },
                    { scale: isHighlighted ? highlightScaleAnim : 1 },
                  ],
                },
              ]}>
              {showLetter && (
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
});

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
