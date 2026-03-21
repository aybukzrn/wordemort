import React, { useState, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameMode } from './src/types/game';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';

type Screen = 'home' | 'game';

const STORAGE_KEY_MODE = '@wordemort_mode';
const STORAGE_KEY_LEVEL = '@wordemort_level';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('TR');
  const [savedLevel, setSavedLevel] = useState<number>(1);
  const [ready, setReady] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const modeVal = await AsyncStorage.getItem(STORAGE_KEY_MODE);
        const levelVal = await AsyncStorage.getItem(STORAGE_KEY_LEVEL);
        if (modeVal && levelVal) {
          setGameMode(modeVal as GameMode);
          setSavedLevel(parseInt(levelVal, 10) || 1);
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
    if (mode !== gameMode) {
      // Different mode — start fresh
      setSavedLevel(1);
      AsyncStorage.setItem(STORAGE_KEY_MODE, mode);
      AsyncStorage.setItem(STORAGE_KEY_LEVEL, '1');
      setGameMode(mode);
    }
    // Same mode — savedLevel already holds the last checkpoint, keep it
    setScreen('game');
  };

  const handleLevelChange = (level: number) => {
    setSavedLevel(level);
    AsyncStorage.setItem(STORAGE_KEY_LEVEL, String(level));
  };

  // Going home just pauses — progress is kept in AsyncStorage
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
