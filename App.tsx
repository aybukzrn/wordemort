import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameMode } from './src/types/game';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';

type Screen = 'home' | 'game';

const STORAGE_KEY_ACTIVE_MODE = '@wordemort_mode';
const levelKey = (mode: GameMode) => `@wordemort_level_${mode}`;

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('TR');
  const [savedLevel, setSavedLevel] = useState<number>(1);
  const [ready, setReady] = useState(false);

  // In-memory cache of last reached level per mode
  const savedLevels = useRef<Record<GameMode, number>>({ TR: 1, TR_EN: 1, EN_TR: 1 });
  const gameModeRef = useRef<GameMode>('TR');
  gameModeRef.current = gameMode;

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [modeVal, trVal, trEnVal, enTrVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ACTIVE_MODE),
          AsyncStorage.getItem(levelKey('TR')),
          AsyncStorage.getItem(levelKey('TR_EN')),
          AsyncStorage.getItem(levelKey('EN_TR')),
        ]);

        savedLevels.current = {
          TR: parseInt(trVal ?? '1', 10) || 1,
          TR_EN: parseInt(trEnVal ?? '1', 10) || 1,
          EN_TR: parseInt(enTrVal ?? '1', 10) || 1,
        };

        if (modeVal) {
          const mode = modeVal as GameMode;
          setGameMode(mode);
          setSavedLevel(savedLevels.current[mode]);
          setScreen('game');
        }
      } catch {
        // AsyncStorage unavailable — start fresh
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const handleSelectMode = (mode: GameMode) => {
    setGameMode(mode);
    setSavedLevel(savedLevels.current[mode]);
    setScreen('game');
    AsyncStorage.setItem(STORAGE_KEY_ACTIVE_MODE, mode);
  };

  const handleLevelChange = (level: number) => {
    const mode = gameModeRef.current;
    savedLevels.current[mode] = level;
    setSavedLevel(level);
    AsyncStorage.setItem(levelKey(mode), String(level));
  };

  // Going home pauses progress — everything stays in AsyncStorage
  const handleHome = () => {
    setScreen('home');
  };

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a3a6b" />
      {screen === 'home' ? (
        <HomeScreen onSelectMode={handleSelectMode} />
      ) : (
        <GameScreen
          mode={gameMode}
          initialLevel={savedLevel}
          onLevelChange={handleLevelChange}
          onHome={handleHome}
        />
      )}
    </SafeAreaProvider>
  );
}
