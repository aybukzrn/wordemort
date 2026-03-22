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
import { Level } from '../types/game';
import { generateLevel } from '../utils/levelGenerator';
import { useScale } from '../utils/useScale';
import { WordGrid, WordGridRef } from '../components/WordGrid';
import { LetterWheel, LetterWheelRef } from '../components/LetterWheel';
import { WordTooltip } from '../components/WordTooltip';
import {
  getSocket,
  disconnectSocket,
  sendWordFound,
  leaveRoom,
  WordAcceptedPayload,
  OpponentWordPayload,
  LevelCompletePayload,
  LevelStartPayload,
  GameOverPayload,
} from '../utils/socketClient';
import { MultiplayerRoomInfo } from './MultiplayerLobbyScreen';

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

interface Props {
  roomInfo: MultiplayerRoomInfo;
  onLeave: () => void;
}

type GamePhase = 'playing' | 'level_complete' | 'game_over';

export function MultiplayerGameScreen({ roomInfo, onLeave }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [levelNum, setLevelNum] = useState(roomInfo.levelNum);
  const [currentSeed, setCurrentSeed] = useState(roomInfo.seed);
  const [foundWords, setFoundWords] = useState<boolean[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [wrongWord, setWrongWord] = useState('');
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [gameResult, setGameResult] = useState<GameOverPayload | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [tooltip, setTooltip] = useState<{ word: string; actualWord: string; meaning: string } | null>(null);

  const flyingLetters = useRef<FlyLetter[]>([]);
  const [flyingLettersState, setFlyingLettersState] = useState<FlyLetter[]>([]);
  const flyIdRef = useRef(0);
  const selectedIndicesRef = useRef<number[]>([]);
  const wheelRef = useRef<LetterWheelRef>(null);
  const gridRef = useRef<WordGridRef>(null);
  const dotAnims = useRef<Animated.Value[]>([]);

  const levelRef = useRef<Level | null>(null);
  levelRef.current = currentLevel;
  const foundWordsRef = useRef<boolean[]>([]);
  foundWordsRef.current = foundWords;

  // ─── Level generation ──────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentLevel(null);
    setFoundWords([]);
    setSelectedIndices([]);
    setCurrentWord('');
    setWrongWord('');

    const handle = setTimeout(() => {
      const level = generateLevel(levelNum, roomInfo.mode, undefined, currentSeed);
      dotAnims.current = level.words.map(() => new Animated.Value(1));
      setCurrentLevel(level);
      setFoundWords(level.words.map(() => false));
    }, 20);

    return () => clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelNum, currentSeed]);

  // ─── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const onWordAccepted = (payload: WordAcceptedPayload) => {
      const level = levelRef.current;
      if (!level) return;
      const wordIndex = level.words.indexOf(payload.word);
      if (wordIndex < 0) return;

      setMyScore(payload.myScore);
      revealWordAt(wordIndex, payload.word);
    };

    const onWordRejected = (payload: { word: string }) => {
      // Word was already taken by opponent
      setWrongWord(payload.word);
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 9, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setWrongWord(''), 800);
    };

    const onOpponentWord = (payload: OpponentWordPayload) => {
      const level = levelRef.current;
      if (!level) return;
      const wordIndex = level.words.indexOf(payload.word);
      if (wordIndex >= 0) revealWordAt(wordIndex, payload.word);
      setOpponentScore(payload.opponentScore);
    };

    const onLevelComplete = (_payload: LevelCompletePayload) => {
      setPhase('level_complete');
    };

    const onLevelStart = (payload: LevelStartPayload) => {
      setPhase('playing');
      setCurrentSeed(payload.seed);
      setLevelNum(payload.levelNum);
    };

    const onGameOver = (payload: GameOverPayload) => {
      setGameResult(payload);
      setPhase('game_over');
    };

    const onOpponentLeft = () => {
      setOpponentLeft(true);
    };

    socket.on('word_accepted', onWordAccepted);
    socket.on('word_rejected', onWordRejected);
    socket.on('opponent_word', onOpponentWord);
    socket.on('level_complete', onLevelComplete);
    socket.on('level_start', onLevelStart);
    socket.on('game_over', onGameOver);
    socket.on('opponent_left', onOpponentLeft);

    return () => {
      socket.off('word_accepted', onWordAccepted);
      socket.off('word_rejected', onWordRejected);
      socket.off('opponent_word', onOpponentWord);
      socket.off('level_complete', onLevelComplete);
      socket.off('level_start', onLevelStart);
      socket.off('game_over', onGameOver);
      socket.off('opponent_left', onOpponentLeft);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Dot bounce ────────────────────────────────────────────────────────────
  const animateDot = useCallback((idx: number) => {
    const dot = dotAnims.current[idx];
    if (!dot) return;
    Animated.sequence([
      Animated.timing(dot, { toValue: 1.8, duration: 130, useNativeDriver: true }),
      Animated.spring(dot, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // ─── Reveal word in grid ───────────────────────────────────────────────────
  const revealWordAt = useCallback(
    (wordIndex: number, _word: string) => {
      setFoundWords(prev => {
        const next = [...prev];
        next[wordIndex] = true;
        return next;
      });
      animateDot(wordIndex);
    },
    [animateDot],
  );

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

  const handleWordSubmit = useCallback(
    (word: string) => {
      const level = levelRef.current;
      if (!level || word.length < 2) return;

      const wordIndex = level.words.indexOf(word);
      if (wordIndex < 0 || foundWordsRef.current[wordIndex]) {
        // Not a valid word or already found locally — shake
        setWrongWord(word);
        shakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 9, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setWrongWord(''), 800);
        return;
      }

      // Fly animation
      const placement = level.placements.find(p => p.word === word);
      const capturedIndices = [...selectedIndicesRef.current];
      const wheel = wheelRef.current;
      const grid = gridRef.current;

      sendWordFound({ word, totalWordsInLevel: level.words.length });

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

          flyingLetters.current = [...flyingLetters.current, ...newLetters];
          setFlyingLettersState([...flyingLetters.current]);

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
          setTimeout(() => {
            flyingLetters.current = flyingLetters.current.filter(
              fl => !newLetters.some(nl => nl.id === fl.id),
            );
            setFlyingLettersState([...flyingLetters.current]);
          }, totalDuration + 220);
        });
      }
    },
    [shakeAnim],
  );

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

  const handleLeave = useCallback(() => {
    leaveRoom();
    disconnectSocket();
    onLeave();
  }, [onLeave]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (!currentLevel) {
    return (
      <View style={[styles.screen, styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Seviye hazırlanıyor…</Text>
      </View>
    );
  }

  const displayWord = currentWord || wrongWord;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowLeaveConfirm(true)} style={styles.leaveBtn}>
          <Text style={[styles.leaveBtnText, { fontSize: Math.round(13 * s) }]}>✕</Text>
        </TouchableOpacity>

        {/* Word display */}
        <Animated.View
          style={[
            styles.wordArea,
            displayWord && styles.wordAreaActive,
            wrongWord && styles.wordAreaWrong,
            { transform: [{ translateX: shakeAnim }], borderRadius: Math.round(10 * s) },
          ]}>
          <Text style={[styles.wordText, { fontSize: Math.round(20 * s) }]}>
            {displayWord || ' '}
          </Text>
        </Animated.View>

        {/* Scores */}
        <View style={styles.scores}>
          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreName, { fontSize: Math.round(10 * s) }]} numberOfLines={1}>
              Sen
            </Text>
            <Text style={[styles.scoreNum, { fontSize: Math.round(20 * s) }]}>{myScore}</Text>
          </View>
          <Text style={[styles.scoreDivider, { fontSize: Math.round(14 * s) }]}>–</Text>
          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreName, { fontSize: Math.round(10 * s) }]} numberOfLines={1}>
              {roomInfo.opponentName ?? 'Rakip'}
            </Text>
            <Text style={[styles.scoreNum, { fontSize: Math.round(20 * s) }]}>{opponentScore}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, isLandscape && styles.contentLandscape]}>
        <View style={isLandscape ? styles.landscapeLeft : styles.portraitGrid}>
          <WordGrid
            ref={gridRef}
            level={currentLevel}
            foundWords={foundWords}
            onWordPress={handleWordPress}
            highlightedWord={tooltip?.actualWord}
            containerWidth={isLandscape ? Math.floor(screenWidth / 2) : undefined}
            containerHeight={isLandscape ? screenHeight - 80 : undefined}
          />
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

        <View style={isLandscape ? styles.landscapeRight : styles.portraitWheel}>
          <LetterWheel
            ref={wheelRef}
            letters={currentLevel.letters}
            selectedIndices={selectedIndices}
            onSelectionChange={handleSelectionChange}
            onWordSubmit={handleWordSubmit}
            levelKey={levelNum}
            maxSize={isLandscape ? Math.round(Math.min(screenWidth / 2, screenHeight) - 48) : undefined}
          />
        </View>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <WordTooltip
          word={tooltip.word}
          meaning={tooltip.meaning}
          onDismiss={() => setTooltip(null)}
        />
      )}

      {/* Fly letters overlay */}
      {flyingLettersState.length > 0 && (
        <View style={styles.flyOverlay} pointerEvents="none">
          {flyingLettersState.map(fl => {
            const translateX = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [0, fl.endX - fl.startX] });
            const translateY = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [0, fl.endY - fl.startY] });
            const scale = fl.anim.interpolate({ inputRange: [0, 1], outputRange: [fl.startSize / fl.endSize, 1] });
            return (
              <Animated.View
                key={fl.id}
                style={[
                  styles.flyLetter,
                  {
                    width: fl.endSize,
                    height: fl.endSize,
                    borderRadius: Math.round(fl.endSize / 6),
                    left: fl.startX - fl.endSize / 2,
                    top: fl.startY - fl.endSize / 2,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}>
                <Text style={[styles.flyLetterText, { fontSize: Math.round(fl.endSize * 0.5) }]}>
                  {fl.letter}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Mode label — bottom-left, low opacity */}
      <Text style={[styles.modeLabel, { fontSize: Math.round(12 * s), bottom: insets.bottom + Math.round(10 * s) }]}>
        {roomInfo.mode}
      </Text>

      {/* Level label — bottom-right, low opacity */}
      <Text style={[styles.levelLabel, { fontSize: Math.round(12 * s), bottom: insets.bottom + Math.round(10 * s) }]}>
        {levelNum} / {roomInfo.totalLevels}
      </Text>

      {/* Level complete overlay */}
      {phase === 'level_complete' && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Seviye Tamam!</Text>
            <Text style={styles.overlayScore}>{myScore} – {opponentScore}</Text>
            <ActivityIndicator color="#1a3a6b" style={{ marginTop: 8 }} />
            <Text style={styles.overlayHint}>Sonraki seviye başlıyor…</Text>
          </View>
        </View>
      )}

      {/* Game over modal */}
      <Modal visible={phase === 'game_over'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            {gameResult && (
              <>
                <Text style={styles.overlayTitle}>
                  {gameResult.result === 'win' ? '🏆 Kazandın!' : gameResult.result === 'lose' ? '😔 Kaybettin' : '🤝 Berabere'}
                </Text>
                <Text style={styles.overlayScore}>{gameResult.myScore} – {gameResult.opponentScore}</Text>
              </>
            )}
            <TouchableOpacity style={styles.overlayBtn} onPress={handleLeave}>
              <Text style={styles.overlayBtnText}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Opponent left */}
      <Modal visible={opponentLeft} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Rakip ayrıldı</Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={handleLeave}>
              <Text style={styles.overlayBtnText}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave confirm */}
      <Modal visible={showLeaveConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLeaveConfirm(false)}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Oyundan çık?</Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={handleLeave}>
              <Text style={styles.overlayBtnText}>Evet, çık</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overlayCancelBtn} onPress={() => setShowLeaveConfirm(false)}>
              <Text style={styles.overlayCancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1a3a6b' },
  loading: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  leaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  wordArea: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  wordAreaActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  wordAreaWrong: { backgroundColor: 'rgba(220,60,60,0.5)' },
  wordText: { color: '#fff', fontWeight: '700', letterSpacing: 4 },
  scores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreBlock: { alignItems: 'center', minWidth: 36 },
  scoreName: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  scoreNum: { color: '#f0c040', fontWeight: '800' },
  scoreDivider: { color: 'rgba(255,255,255,0.4)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: 16 },
  contentLandscape: { flexDirection: 'row' },
  landscapeLeft: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  landscapeRight: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  portraitGrid: { alignItems: 'center', gap: 12 },
  portraitWheel: { alignItems: 'center', justifyContent: 'center' },
  progressContainer: { flexDirection: 'row', gap: 8 },
  progressDot: { backgroundColor: 'rgba(255,255,255,0.3)' },
  progressDotFound: { backgroundColor: '#f0c040' },
  modeLabel: {
    position: 'absolute',
    left: 14,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  levelLabel: {
    position: 'absolute',
    right: 14,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  flyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  flyLetter: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  flyLetterText: { color: '#1a3a6b', fontWeight: '700' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
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
  overlayTitle: { fontSize: 24, fontWeight: '800', color: '#1a3a6b' },
  overlayScore: { fontSize: 36, fontWeight: '800', color: '#1a3a6b', letterSpacing: 4 },
  overlayHint: { fontSize: 13, color: '#888', marginTop: 4 },
  overlayBtn: {
    backgroundColor: '#1a3a6b',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  overlayBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  overlayCancelBtn: { paddingVertical: 10 },
  overlayCancelText: { color: '#888', fontSize: 14 },
});
