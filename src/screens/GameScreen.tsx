import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Level, GameMode } from '../types/game';
import { generateLevel } from '../utils/levelGenerator';
import { useScale } from '../utils/useScale';
import { GameHeader } from '../components/GameHeader';
import { WordGrid, WordGridRef } from '../components/WordGrid';
import { LetterWheel, LetterWheelRef } from '../components/LetterWheel';
import { WordTooltip } from '../components/WordTooltip';

interface FlyLetter {
  id: number;
  letter: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startSize: number;
  endSize: number;
  anim: Animated.Value;
}

const MAX_HINTS = 3;

interface Props {
  mode: GameMode;
  initialLevel?: number;
  onLevelChange?: (level: number) => void;
  onHome: () => void;
}

export function GameScreen({ mode, initialLevel = 1, onLevelChange, onHome }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();

  const [levelNum, setLevelNum] = useState(initialLevel);
  const [restartKey, setRestartKey] = useState(0);

  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [foundWords, setFoundWords] = useState<boolean[]>([]);
  const [hints, setHints] = useState(MAX_HINTS);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [wrongWord, setWrongWord] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tooltip, setTooltip] = useState<{
    word: string;       // boş = henüz bulunmamış
    actualWord: string; // her zaman gerçek kelime (highlight için)
    meaning: string;
  } | null>(null);


  // Fly-to-grid animation
  const [flyingLetters, setFlyingLetters] = useState<FlyLetter[]>([]);
  const flyIdRef = useRef(0);
  const selectedIndicesRef = useRef<number[]>([]);
  const wheelRef = useRef<LetterWheelRef>(null);
  const gridRef = useRef<WordGridRef>(null);

  // Per-word progress dot animations
  const dotAnims = useRef<Animated.Value[]>([]);

  // Word history — words from the last ~10 levels, to avoid repeats
  const recentWordsRef = useRef<string[]>([]);
  const HISTORY_SIZE = 60; // ~10 levels × 6 words avg

  // Stable refs for use in callbacks
  const levelRef = useRef<Level | null>(null);
  levelRef.current = currentLevel;
  const foundWordsRef = useRef<boolean[]>([]);
  foundWordsRef.current = foundWords;

  // ─── Level generation ──────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentLevel(null);
    setFoundWords([]);
    setHints(MAX_HINTS);
    setSelectedIndices([]);
    setCurrentWord('');
    setWrongWord('');
    setTooltip(null);

    const handle = setTimeout(() => {
      const exclude = new Set(recentWordsRef.current);
      const level = generateLevel(levelNum, mode, exclude);
      // Add this level's words to history after generation
      recentWordsRef.current = [...recentWordsRef.current, ...level.words].slice(-HISTORY_SIZE);
      dotAnims.current = level.words.map(() => new Animated.Value(1));
      setCurrentLevel(level);
      setFoundWords(level.words.map(() => false));
    }, 20);

    return () => clearTimeout(handle);
  }, [levelNum, restartKey]);

  // ─── Shake animation ───────────────────────────────────────────────────────
  const shakeAnimation = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);


  // ─── Dot bounce animation ──────────────────────────────────────────────────
  const animateDot = useCallback((idx: number) => {
    const dot = dotAnims.current[idx];
    if (!dot) return;
    Animated.sequence([
      Animated.timing(dot, { toValue: 1.8, duration: 130, useNativeDriver: true }),
      Animated.spring(dot, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(
    (indices: number[]) => {
      selectedIndicesRef.current = indices;
      setSelectedIndices(indices);
      if (currentLevel) {
        setCurrentWord(indices.map(i => currentLevel.letters[i]).join(''));
      }
    },
    [currentLevel],
  );

  const revealWord = useCallback(
    (wordIndex: number, newFoundWords: boolean[]) => {
      setFoundWords(newFoundWords);
      animateDot(wordIndex);
      if (newFoundWords.every(Boolean)) {
        setTimeout(() => {
          const next = (levelRef.current?.level ?? 1) + 1;
          onLevelChange?.(next);
          setLevelNum(next);
        }, 700);
      }
    },
    [animateDot, onLevelChange],
  );

  const handleWordSubmit = useCallback(
    (word: string) => {
      const level = levelRef.current;
      if (!level || word.length < 2) return;

      const wordIndex = level.words.indexOf(word);
      const currentFound = foundWordsRef.current;

      if (wordIndex < 0 || currentFound[wordIndex]) {
        setWrongWord(word);
        shakeAnimation();
        setTimeout(() => setWrongWord(''), 800);
        return;
      }

      const newFoundWords = [...currentFound];
      newFoundWords[wordIndex] = true;

      const placement = level.placements.find(p => p.word === word);
      const capturedIndices = [...selectedIndicesRef.current];
      const wheel = wheelRef.current;
      const grid = gridRef.current;

      if (placement && capturedIndices.length > 0 && wheel && grid) {
        grid.getCellCentersAbsolute(placement, cellCenters => {
          const letterR = wheel.getLetterRadius();
          const newLetters: FlyLetter[] = capturedIndices.map((letterIdx, i) => {
            const from = wheel.getLetterCenterAbsolute(letterIdx);
            const to = cellCenters[i] ?? cellCenters[cellCenters.length - 1];
            return {
              id: ++flyIdRef.current,
              letter: level.letters[letterIdx],
              startX: from.x,
              startY: from.y,
              endX: to.x,
              endY: to.y,
              startSize: letterR * 2,
              endSize: to.size,
              anim: new Animated.Value(0),
            };
          });

          setFlyingLetters(prev => [...prev, ...newLetters]);

          newLetters.forEach((fl, i) => {
            setTimeout(() => {
              Animated.timing(fl.anim, {
                toValue: 1,
                duration: 320,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start();
            }, i * 35);
          });

          const totalDuration = (newLetters.length - 1) * 35 + 320 + 60;
          // Reveal word first so grid cell animation starts, then remove fly letters
          // once the grid letter opacity has become visible (~200ms into the spring)
          setTimeout(() => {
            revealWord(wordIndex, newFoundWords);
            setTimeout(() => {
              setFlyingLetters(prev => prev.filter(fl => !newLetters.some(nl => nl.id === fl.id)));
            }, 220);
          }, totalDuration);
        });
      } else {
        revealWord(wordIndex, newFoundWords);
      }
    },
    [shakeAnimation, revealWord],
  );

  const handleHint = useCallback(() => {
    if (hints <= 0 || !currentLevel) return;
    const idx = foundWordsRef.current.indexOf(false);
    if (idx < 0) return;

    const newFoundWords = [...foundWordsRef.current];
    newFoundWords[idx] = true;
    setFoundWords(newFoundWords);
    setHints(h => h - 1);
    animateDot(idx);

    if (newFoundWords.every(Boolean)) {
      setTimeout(() => {
        const next = (levelRef.current?.level ?? 1) + 1;
        onLevelChange?.(next);
        setLevelNum(next);
      }, 500);
    }
  }, [hints, currentLevel, animateDot, onLevelChange]);

  const handleNewGame = useCallback(() => {
    setShowSettings(false);
    recentWordsRef.current = [];
    onLevelChange?.(1);
    setLevelNum(1);
    setRestartKey(k => k + 1);
  }, [onLevelChange]);

  const handleHome = useCallback(() => {
    setShowSettings(false);
    onHome();
  }, [onHome]);

  const handleWordPress = useCallback(
    (word: string, isRevealed: boolean) => {
      if (!currentLevel) return;
      setTooltip({
        word: isRevealed ? word : '',
        actualWord: word,
        meaning: currentLevel.meanings[word] ?? '',
      });
    },
    [currentLevel],
  );

  const displayWord = currentWord || wrongWord;

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (!currentLevel) {
    return (
      <View style={[styles.screen, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Hazırlanıyor…</Text>
      </View>
    );
  }

  // ─── Game ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <GameHeader
        currentWord={displayWord}
        isWrong={!!wrongWord}
        shakeAnim={shakeAnim}
        hints={hints}
        onHint={handleHint}
        onSettings={() => setShowSettings(true)}
      />

      {/* Content area — tooltip overlay is placed here to cover grid + wheel */}
      <View style={styles.content}>
        {/* Grid */}
        <View style={styles.gridContainer}>
          <WordGrid
            ref={gridRef}
            level={currentLevel}
            foundWords={foundWords}
            onWordPress={handleWordPress}
            highlightedWord={tooltip?.actualWord}
          />
        </View>

        {/* Letter wheel */}
        <View style={styles.wheelContainer}>
          <LetterWheel
            ref={wheelRef}
            letters={currentLevel.letters}
            selectedIndices={selectedIndices}
            onSelectionChange={handleSelectionChange}
            onWordSubmit={handleWordSubmit}
            levelKey={currentLevel.level}
          />
        </View>

        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {currentLevel.words.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.progressDot,
                foundWords[i] && styles.progressDotFound,
                {
                  width: Math.round(8 * s),
                  height: Math.round(8 * s),
                  borderRadius: Math.round(4 * s),
                  transform: [{ scale: dotAnims.current[i] ?? new Animated.Value(1) }],
                },
              ]}
            />
          ))}
        </View>


        {/* Tooltip — covers the full content area (grid + wheel) */}
        {tooltip && (
          <WordTooltip
            word={tooltip.word}
            meaning={tooltip.meaning}
            onDismiss={() => setTooltip(null)}
          />

        )}
      </View>

      {/* Flying letters — full-screen absolute overlay so measureInWindow coords map directly */}
      {flyingLetters.length > 0 && (
        <View style={styles.flyLettersOverlay} pointerEvents="none">
          {flyingLetters.map(fl => {
            // View is sized at endSize and positioned so its center starts at (startX, startY).
            // scale starts at startSize/endSize (appears as wheel circle) and animates to 1 (grid cell size).
            // translateX/Y moves the center from start to end position.
            const translateX = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [0, fl.endX - fl.startX] });
            const translateY = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [0, fl.endY - fl.startY] });
            const scale = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [fl.startSize / fl.endSize, 1] });
            const fontSize = Math.round(fl.endSize * 0.5);
            return (
              <Animated.View
                key={fl.id}
                style={[
                  styles.flyLetterCircle,
                  {
                    width: fl.endSize,
                    height: fl.endSize,
                    borderRadius: Math.round(fl.endSize / 6),
                    left: fl.startX - fl.endSize / 2,
                    top: fl.startY - fl.endSize / 2,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}>
                <Text style={[styles.flyLetterText, { fontSize }]}>{fl.letter}</Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Level label — bottom-right, low opacity */}
      <Text style={[styles.levelLabel, { fontSize: Math.round(12 * s), bottom: insets.bottom + Math.round(10 * s) }]}>
        Seviye {currentLevel.level}
      </Text>

      {/* Settings modal */}
      <Modal visible={showSettings} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettings(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ayarlar</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNewGame}>
              <Text style={styles.primaryBtnText}>Yeni Oyun Başlat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleHome}>
              <Text style={styles.secondaryBtnText}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.secondaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a3a6b',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingBottom: 16,
  },
  gridContainer: {
    alignItems: 'center',
  },
  wordDisplayContainer: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordDisplayEmpty: {
    width: 60,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  wordDisplay: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  wordDisplayActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  wordDisplayWrong: {
    backgroundColor: 'rgba(220,60,60,0.5)',
  },
  wordDisplayText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
  },
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressDotFound: {
    backgroundColor: '#f0c040',
  },
  levelLabel: {
    position: 'absolute',
    right: 14,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: 280,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a3a6b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#1a3a6b',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(26,58,107,0.08)',
  },
  secondaryBtnText: {
    color: '#1a3a6b',
    fontSize: 15,
    fontWeight: '600',
  },
  flyLettersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  flyLetterCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 4,
    zIndex: 20,
  },
  flyLetterText: {
    color: '#1a3a6b',
    fontWeight: '700',
  },
});
