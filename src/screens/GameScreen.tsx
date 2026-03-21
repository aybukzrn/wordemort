import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Level, GameMode } from '../types/game';
import { generateLevel } from '../utils/levelGenerator';
import { useScale } from '../utils/useScale';
import { GameHeader } from '../components/GameHeader';
import { WordGrid } from '../components/WordGrid';
import { LetterWheel } from '../components/LetterWheel';
import { WordTooltip } from '../components/WordTooltip';

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

  // Fly-up animation when a correct word is found
  const [flyText, setFlyText] = useState<string | null>(null);
  const flyAnim = useRef(new Animated.Value(0)).current;

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
    setFlyText(null);

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

  // ─── Fly-up word animation ─────────────────────────────────────────────────
  const showFlyUp = useCallback(
    (word: string) => {
      flyAnim.setValue(0);
      setFlyText(word);
      Animated.timing(flyAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => setFlyText(null));
    },
    [flyAnim],
  );

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
      setSelectedIndices(indices);
      if (currentLevel) {
        setCurrentWord(indices.map(i => currentLevel.letters[i]).join(''));
      }
    },
    [currentLevel],
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

      // Correct word found
      const newFoundWords = [...currentFound];
      newFoundWords[wordIndex] = true;
      setFoundWords(newFoundWords);

      showFlyUp(word);
      animateDot(wordIndex);

      if (newFoundWords.every(Boolean)) {
        setTimeout(() => {
          const next = (levelRef.current?.level ?? 1) + 1;
          onLevelChange?.(next);
          setLevelNum(next);
        }, 700);
      }
    },
    [shakeAnimation, showFlyUp, animateDot, onLevelChange],
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
        level={currentLevel.level}
        hints={hints}
        onHint={handleHint}
        onSettings={() => setShowSettings(true)}
      />

      {/* Content area — tooltip overlay is placed here to cover grid + wheel */}
      <View style={styles.content}>
        {/* Grid */}
        <View style={styles.gridContainer}>
          <WordGrid
            level={currentLevel}
            foundWords={foundWords}
            onWordPress={handleWordPress}
            highlightedWord={tooltip?.actualWord}
          />
        </View>

        {/* Current word display */}
        <Animated.View
          style={[
            styles.wordDisplayContainer,
            { height: Math.round(52 * s), transform: [{ translateX: shakeAnim }] },
          ]}>
          {displayWord.length > 0 ? (
            <View
              style={[
                styles.wordDisplay,
                wrongWord ? styles.wordDisplayWrong : styles.wordDisplayActive,
                {
                  paddingHorizontal: Math.round(28 * s),
                  paddingVertical: Math.round(12 * s),
                  borderRadius: Math.round(16 * s),
                  minWidth: Math.round(80 * s),
                },
              ]}>
              <Text style={[styles.wordDisplayText, { fontSize: Math.round(22 * s) }]}>{displayWord}</Text>
            </View>
          ) : (
            <View
              style={[
                styles.wordDisplayEmpty,
                {
                  width: Math.round(60 * s),
                  height: Math.round(46 * s),
                  borderRadius: Math.round(16 * s),
                },
              ]}
            />
          )}
        </Animated.View>

        {/* Letter wheel */}
        <View style={styles.wheelContainer}>
          <LetterWheel
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

        {/* Fly-up word (correct word celebration) */}
        <View style={styles.flyContainer} pointerEvents="none">
          {flyText && (
            <Animated.Text
              style={[
                styles.flyText,
                {
                  fontSize: Math.round(24 * s),
                  opacity: flyAnim.interpolate({
                    inputRange: [0, 0.15, 0.75, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: flyAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -90],
                      }),
                    },
                    {
                      scale: flyAnim.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0.7, 1.1, 1],
                      }),
                    },
                  ],
                },
              ]}>
              {flyText}
            </Animated.Text>
          )}
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
  flyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  flyText: {
    color: '#f0c040',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
});
