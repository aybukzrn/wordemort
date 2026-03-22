import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameMode } from './src/types/game';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { MultiplayerLobbyScreen, MultiplayerRoomInfo } from './src/screens/MultiplayerLobbyScreen';
import { MultiplayerGameScreen } from './src/screens/MultiplayerGameScreen';

type Screen = 'home' | 'game' | 'mp_lobby' | 'mp_game';

const STORAGE_KEY_ACTIVE_MODE = '@wordemort_mode';
const STORAGE_KEY_PLAYER_NAME = '@wordemort_player_name';
const levelKey = (mode: GameMode) => `@wordemort_level_${mode}`;

function NamePrompt({ onConfirm }: { onConfirm: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  return (
    <View style={[promptStyles.overlay, { paddingBottom: insets.bottom }]}>
      <View style={promptStyles.card}>
        <Text style={promptStyles.title}>Adın ne?</Text>
        <Text style={promptStyles.subtitle}>Çok oyunculu modda kullanılacak</Text>
        <TextInput
          style={promptStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="Kullanıcı adı"
          placeholderTextColor="#aaa"
          maxLength={16}
          autoFocus
        />
        <TouchableOpacity
          style={[promptStyles.btn, !name.trim() && promptStyles.btnDisabled]}
          onPress={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim()}>
          <Text style={promptStyles.btnText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const promptStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: 300,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1a3a6b' },
  subtitle: { fontSize: 13, color: '#888' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1a3a6b',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#1a3a6b',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('TR');
  const [savedLevel, setSavedLevel] = useState<number>(1);
  const [ready, setReady] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [roomInfo, setRoomInfo] = useState<MultiplayerRoomInfo | null>(null);

  const savedLevels = useRef<Record<GameMode, number>>({ TR: 1, TR_EN: 1, EN_TR: 1 });
  const gameModeRef = useRef<GameMode>('TR');
  gameModeRef.current = gameMode;

  useEffect(() => {
    (async () => {
      try {
        const [modeVal, trVal, trEnVal, enTrVal, nameVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ACTIVE_MODE),
          AsyncStorage.getItem(levelKey('TR')),
          AsyncStorage.getItem(levelKey('TR_EN')),
          AsyncStorage.getItem(levelKey('EN_TR')),
          AsyncStorage.getItem(STORAGE_KEY_PLAYER_NAME),
        ]);

        savedLevels.current = {
          TR: parseInt(trVal ?? '1', 10) || 1,
          TR_EN: parseInt(trEnVal ?? '1', 10) || 1,
          EN_TR: parseInt(enTrVal ?? '1', 10) || 1,
        };

        if (nameVal) setPlayerName(nameVal);

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

  const handleHome = () => {
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_MODE);
    setScreen('home');
  };

  const handleMultiplayerPress = () => {
    if (!playerName) {
      setShowNamePrompt(true);
    } else {
      setScreen('mp_lobby');
    }
  };

  const handleNameConfirm = (name: string) => {
    setPlayerName(name);
    AsyncStorage.setItem(STORAGE_KEY_PLAYER_NAME, name);
    setShowNamePrompt(false);
    setScreen('mp_lobby');
  };

  const handleRoomReady = (info: MultiplayerRoomInfo) => {
    setRoomInfo(info);
    setScreen('mp_game');
  };

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a3a6b" />

      {screen === 'home' && (
        <HomeScreen onSelectMode={handleSelectMode} onMultiplayer={handleMultiplayerPress} />
      )}
      {screen === 'game' && (
        <GameScreen
          mode={gameMode}
          initialLevel={savedLevel}
          onLevelChange={handleLevelChange}
          onHome={handleHome}
        />
      )}
      {screen === 'mp_lobby' && (
        <MultiplayerLobbyScreen
          playerName={playerName}
          onRoomReady={handleRoomReady}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'mp_game' && roomInfo && (
        <MultiplayerGameScreen
          roomInfo={roomInfo}
          onLeave={() => setScreen('home')}
        />
      )}

      {/* Name prompt modal */}
      <Modal visible={showNamePrompt} transparent animationType="fade">
        <NamePrompt onConfirm={handleNameConfirm} />
      </Modal>
    </SafeAreaProvider>
  );
}
