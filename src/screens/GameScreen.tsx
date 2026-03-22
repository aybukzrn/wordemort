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
  useWindowDimensions,
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
  initialUsedWords?: string[];
  onLevelChange?: (level: number) => void;
  onUsedWordsChange?: (words: string[]) => void;
  onHome: () => void;
}

export function GameScreen({ mode, initialLevel = 1, initialUsedWords, onLevelChange, onUsedWordsChange, onHome }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const [levelNum, setLevelNum] = useState(initialLevel);
  const [restartKey, setRestartKey] = useState(0);

  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [foundWords, setFoundWords] = useState<boolean[]>([]);
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
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

  // Word history — persisted across app restarts; initialized from saved state
  const usedWordsRef = useRef<Set<string>>(new Set(initialUsedWords));

  // Stable refs for use in callbacks
  const levelRef = useRef<Level | null>(null);
  levelRef.current = currentLevel;
  const foundWordsRef = useRef<boolean[]>([]);
  foundWordsRef.current = foundWords;

  // ─── Level generation ──────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentLevel(null);
    setLoadingTimeout(false);
    setFoundWords([]);
    setHints(MAX_HINTS);
    setSelectedIndices([]);
    setCurrentWord('');
    setWrongWord('');
    setTooltip(null);
    setHintedCells(new Set());

    const handle = setTimeout(() => {
      const level = generateLevel(levelNum, mode, usedWordsRef.current);
      level.words.forEach(w => usedWordsRef.current.add(w));
      onUsedWordsChange?.([...usedWordsRef.current]);
      dotAnims.current = level.words.map(() => new Animated.Value(1));
      setCurrentLevel(level);
      setFoundWords(level.words.map(() => false));
    }, 20);

    const timeoutHandle = setTimeout(() => setLoadingTimeout(true), 20000);

    return () => { clearTimeout(handle); clearTimeout(timeoutHandle); };
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

    // Build set of already-visible cells (found words + already hinted)
    const visibleCells = new Set(hintedCells);
    foundWordsRef.current.forEach((found, wordIdx) => {
      if (!found) return;
      const placement = currentLevel.placements[wordIdx];
      if (!placement) return;
      for (let i = 0; i < placement.word.length; i++) {
        const r = placement.dir === 'H' ? placement.row : placement.row + i;
        const c = placement.dir === 'H' ? placement.col + i : placement.col;
        visibleCells.add(`${r},${c}`);
      }
    });

    const candidates: Array<{ wordIdx: number; cellKey: string }> = [];
    foundWordsRef.current.forEach((found, wordIdx) => {
      if (found) return;
      const placement = currentLevel.placements[wordIdx];
      if (!placement) return;
      for (let i = 0; i < placement.word.length; i++) {
        const r = placement.dir === 'H' ? placement.row : placement.row + i;
        const c = placement.dir === 'H' ? placement.col + i : placement.col;
        const key = `${r},${c}`;
        if (!visibleCells.has(key)) candidates.push({ wordIdx, cellKey: key });
      }
    });

    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setHintedCells(prev => new Set([...prev, pick.cellKey]));
    setHints(h => h - 1);
  }, [hints, currentLevel, hintedCells]);

  const handleNewGame = useCallback(() => {
    setShowSettings(false);
    usedWordsRef.current = new Set();
    onUsedWordsChange?.([]);
    onLevelChange?.(1);
    setLevelNum(1);
    setRestartKey(k => k + 1);
  }, [onLevelChange, onUsedWordsChange]);

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
        {loadingTimeout ? (
          <View style={[styles.timeoutCard, { borderRadius: Math.round(12 * s), padding: Math.round(28 * s) }]}>
            <Text style={[styles.timeoutTitle, { fontSize: Math.round(17 * s) }]}>
              Görünüşe göre kelimeleri bitirdin!
            </Text>
            <Text style={[styles.timeoutSubtitle, { fontSize: Math.round(13 * s) }]}>
              Yeniden başlamak ister misin?
            </Text>
            <TouchableOpacity
              style={[styles.timeoutBtn, { borderRadius: Math.round(10 * s), paddingVertical: Math.round(13 * s), marginTop: Math.round(16 * s) }]}
              onPress={handleNewGame}>
              <Text style={[styles.timeoutBtnText, { fontSize: Math.round(15 * s) }]}>Yeniden Başla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timeoutCancelBtn, { marginTop: Math.round(10 * s) }]}
              onPress={handleHome}>
              <Text style={[styles.timeoutCancelText, { fontSize: Math.round(13 * s) }]}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ActivityIndicator size="large" color="#f2e8d0" />
            <Text style={styles.loadingText}>Hazırlanıyor…</Text>
          </>
        )}
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

      {/* Content area */}
      <View style={[styles.content, isLandscape && styles.contentLandscape]}>
        {/* Left column (portrait: top section) — grid + dots */}
        <View style={isLandscape ? styles.landscapeLeft : styles.portraitGrid}>
          <WordGrid
            ref={gridRef}
            level={currentLevel}
            foundWords={foundWords}
            hintedCells={hintedCells}
            onWordPress={handleWordPress}
            highlightedWord={tooltip?.actualWord}
            containerWidth={isLandscape ? Math.floor(screenWidth / 2) : undefined}
            containerHeight={isLandscape ? screenHeight - 80 : undefined}
          />
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
        </View>

        {/* Right column (portrait: bottom section) — wheel */}
        <View style={isLandscape ? styles.landscapeRight : styles.portraitWheel}>
          <LetterWheel
            ref={wheelRef}
            letters={currentLevel.letters}
            selectedIndices={selectedIndices}
            onSelectionChange={handleSelectionChange}
            onWordSubmit={handleWordSubmit}
            levelKey={currentLevel.level}
            maxSize={isLandscape ? Math.round(Math.min(screenWidth / 2, screenHeight) - 48) : undefined}
          />
        </View>

        {/* Tooltip — covers the full content area */}
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
    backgroundColor: '#2d2926',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  progressDotFound: {
    backgroundColor: '#f0c040',
    borderColor: '#c49020',
  },
  contentLandscape: {
    flexDirection: 'row',
  },
  landscapeLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  landscapeRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitGrid: {
    alignItems: 'center',
    gap: 12,
  },
  portraitWheel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    position: 'absolute',
    right: 14,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#f2e8d0',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    width: 290,
    gap: 10,
    borderBottomWidth: 5,
    borderBottomColor: '#c4a870',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2a1a08',
    marginBottom: 6,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7a5a30',
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: '#2e8040',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
    borderBottomWidth: 4,
    borderBottomColor: '#1a5228',
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 10,
    borderBottomWidth: 4,
    borderBottomColor: '#8f5800',
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#c47a15',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  flyLettersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  timeoutCard: {
    backgroundColor: '#f2e8d0',
    alignItems: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#c4a870',
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  timeoutTitle: {
    color: '#2a1a08',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  timeoutSubtitle: {
    color: '#7a5a30',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  timeoutBtn: {
    backgroundColor: '#2e8040',
    borderBottomWidth: 4,
    borderBottomColor: '#1a5228',
    alignItems: 'center',
    width: '100%',
  },
  timeoutBtnText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeoutCancelBtn: {
    paddingVertical: 8,
  },
  timeoutCancelText: {
    color: '#7a5a30',
    fontWeight: '600',
  },
  flyLetterCircle: {
    position: 'absolute',
    backgroundColor: '#d6c9a0',
    borderWidth: 2,
    borderColor: '#a89060',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 20,
  },
  flyLetterText: {
    color: '#2a1a08',
    fontWeight: '800',
  },
});
