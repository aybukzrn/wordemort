import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMode } from '../types/game';
import { useScale } from '../utils/useScale';
import {
  getSocket,
  disconnectSocket,
  createRoom,
  joinRoom,
  RoomCreatedPayload,
  JoinSuccessPayload,
} from '../utils/socketClient';

export interface MultiplayerRoomInfo {
  code: string;
  mode: GameMode;
  totalLevels: number;
  seed: number;
  levelNum: number;
  opponentName?: string;
  isCreator: boolean;
}

interface Props {
  playerName: string;
  onRoomReady: (info: MultiplayerRoomInfo) => void;
  onBack: () => void;
}

type Tab = 'create' | 'join';

const MODES: { mode: GameMode; label: string }[] = [
  { mode: 'TR', label: 'Türkçe' },
  { mode: 'TR_EN', label: 'TR → EN' },
  { mode: 'EN_TR', label: 'EN → TR' },
];

const LEVEL_OPTIONS = [3, 5, 7, 10];

export function MultiplayerLobbyScreen({ playerName, onRoomReady, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();

  const [tab, setTab] = useState<Tab>('create');
  const [selectedMode, setSelectedMode] = useState<GameMode>('TR');
  const [totalLevels, setTotalLevels] = useState(5);
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'waiting' | 'loading'>('idle');
  const [roomCode, setRoomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  function setupListeners() {
    const socket = getSocket();

    const onRoomCreated = (payload: RoomCreatedPayload) => {
      setRoomCode(payload.code);
      setStatus('waiting');
    };

    const onOpponentJoined = (payload: { opponentName: string }) => {
      // Creator gets this when joiner connects — game starts
      const socket2 = getSocket();
      socket2.off('room_created', onRoomCreated);
      socket2.off('opponent_joined', onOpponentJoined);
      socket2.off('join_error', onJoinError);
      socket2.off('join_success', onJoinSuccess);
      cleanupRef.current = null;

      onRoomReady({
        code: roomCode || '',
        mode: selectedMode,
        totalLevels,
        seed: 0, // will be set properly when backend sends room_created
        levelNum: 1,
        opponentName: payload.opponentName,
        isCreator: true,
      });
    };

    const onJoinSuccess = (payload: JoinSuccessPayload) => {
      socket.off('room_created', onRoomCreated);
      socket.off('opponent_joined', onOpponentJoined);
      socket.off('join_error', onJoinError);
      socket.off('join_success', onJoinSuccess);
      cleanupRef.current = null;

      onRoomReady({
        code: payload.code,
        mode: payload.mode,
        totalLevels: payload.totalLevels,
        seed: payload.seed,
        levelNum: payload.levelNum,
        opponentName: payload.opponentName,
        isCreator: false,
      });
    };

    const onJoinError = (payload: { message: string }) => {
      setStatus('idle');
      setErrorMsg(payload.message);
    };

    socket.on('room_created', onRoomCreated);
    socket.on('opponent_joined', onOpponentJoined);
    socket.on('join_success', onJoinSuccess);
    socket.on('join_error', onJoinError);

    cleanupRef.current = () => {
      socket.off('room_created', onRoomCreated);
      socket.off('opponent_joined', onOpponentJoined);
      socket.off('join_success', onJoinSuccess);
      socket.off('join_error', onJoinError);
    };
  }

  // We need to capture roomCode in the opponent_joined closure after it's set.
  // Use a ref so the handler always has the latest value.
  const roomCodeRef = useRef('');
  roomCodeRef.current = roomCode;

  function handleCreate() {
    setErrorMsg('');
    setStatus('loading');
    setupListeners();

    // Re-attach opponent_joined with ref-based roomCode
    const socket = getSocket();
    socket.off('opponent_joined');
    socket.on('opponent_joined', (payload: { opponentName: string }) => {
      socket.off('opponent_joined');
      cleanupRef.current = null;

      // We need the seed — it was delivered in room_created
      // Store it in a ref so this closure can access it
      onRoomReady({
        code: roomCodeRef.current,
        mode: selectedMode,
        totalLevels,
        seed: seedRef.current,
        levelNum: 1,
        opponentName: payload.opponentName,
        isCreator: true,
      });
    });

    createRoom({ mode: selectedMode, totalLevels, playerName });
  }

  const seedRef = useRef(0);

  // Capture seed from room_created
  useEffect(() => {
    const socket = getSocket();
    const onRoomCreated = (p: RoomCreatedPayload) => {
      seedRef.current = p.seed;
    };
    socket.on('room_created', onRoomCreated);
    return () => { socket.off('room_created', onRoomCreated); };
  }, []);

  function handleJoin() {
    const code = joinCode.trim();
    if (code.length !== 4) {
      setErrorMsg('4 haneli oda kodunu gir');
      return;
    }
    setErrorMsg('');
    setStatus('loading');
    setupListeners();
    joinRoom({ code, playerName });
  }

  function handleBack() {
    cleanupRef.current?.();
    disconnectSocket();
    onBack();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { fontSize: Math.round(15 * s) }]}>← Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { fontSize: Math.round(22 * s) }]}>Çok Oyunculu</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabs, { marginHorizontal: Math.round(24 * s), marginTop: Math.round(16 * s) }]}>
        {(['create', 'join'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, t === tab && styles.tabBtnActive, { borderRadius: Math.round(10 * s) }]}
            onPress={() => { setTab(t); setErrorMsg(''); setStatus('idle'); setRoomCode(''); }}>
            <Text style={[styles.tabText, t === tab && styles.tabTextActive, { fontSize: Math.round(14 * s) }]}>
              {t === 'create' ? 'Oda Oluştur' : 'Odaya Katıl'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'create' ? (
        <View style={[styles.section, { paddingHorizontal: Math.round(24 * s) }]}>

          {/* Mode selector */}
          <Text style={[styles.label, { fontSize: Math.round(13 * s) }]}>Mod</Text>
          <View style={[styles.optionRow, { gap: Math.round(10 * s) }]}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.mode}
                style={[styles.optionBtn, m.mode === selectedMode && styles.optionBtnActive, { borderRadius: Math.round(10 * s), paddingVertical: Math.round(10 * s) }]}
                onPress={() => setSelectedMode(m.mode)}>
                <Text style={[styles.optionText, m.mode === selectedMode && styles.optionTextActive, { fontSize: Math.round(13 * s) }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Level count */}
          <Text style={[styles.label, { fontSize: Math.round(13 * s), marginTop: Math.round(20 * s) }]}>Seviye Sayısı</Text>
          <View style={[styles.optionRow, { gap: Math.round(10 * s) }]}>
            {LEVEL_OPTIONS.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.optionBtn, n === totalLevels && styles.optionBtnActive, { borderRadius: Math.round(10 * s), paddingVertical: Math.round(10 * s) }]}
                onPress={() => setTotalLevels(n)}>
                <Text style={[styles.optionText, n === totalLevels && styles.optionTextActive, { fontSize: Math.round(14 * s) }]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {status === 'idle' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { borderRadius: Math.round(14 * s), marginTop: Math.round(32 * s), paddingVertical: Math.round(16 * s) }]}
              onPress={handleCreate}>
              <Text style={[styles.primaryBtnText, { fontSize: Math.round(16 * s) }]}>Oda Oluştur</Text>
            </TouchableOpacity>
          )}

          {status === 'loading' && (
            <ActivityIndicator color="#f0c040" style={{ marginTop: 32 }} />
          )}

          {status === 'waiting' && (
            <View style={[styles.waitingBox, { borderRadius: Math.round(14 * s), marginTop: Math.round(24 * s) }]}>
              <Text style={[styles.waitingLabel, { fontSize: Math.round(13 * s) }]}>Oda Kodu</Text>
              <Text style={[styles.waitingCode, { fontSize: Math.round(44 * s) }]}>{roomCode}</Text>
              <Text style={[styles.waitingHint, { fontSize: Math.round(13 * s) }]}>Rakibini bekliyorsun...</Text>
              <ActivityIndicator color="#f0c040" style={{ marginTop: 12 }} />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.section, { paddingHorizontal: Math.round(24 * s) }]}>
          <Text style={[styles.label, { fontSize: Math.round(13 * s) }]}>Oda Kodu</Text>
          <TextInput
            style={[styles.codeInput, { fontSize: Math.round(28 * s), borderRadius: Math.round(12 * s) }]}
            value={joinCode}
            onChangeText={t => setJoinCode(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            textAlign="center"
          />

          {status === 'idle' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { borderRadius: Math.round(14 * s), marginTop: Math.round(24 * s), paddingVertical: Math.round(16 * s) }]}
              onPress={handleJoin}>
              <Text style={[styles.primaryBtnText, { fontSize: Math.round(16 * s) }]}>Katıl</Text>
            </TouchableOpacity>
          )}

          {status === 'loading' && (
            <ActivityIndicator color="#f0c040" style={{ marginTop: 32 }} />
          )}
        </View>
      )}

      {errorMsg ? (
        <Text style={[styles.errorText, { fontSize: Math.round(13 * s), marginHorizontal: Math.round(24 * s) }]}>
          {errorMsg}
        </Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a3a6b',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backBtn: {
    width: 60,
  },
  backBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  title: {
    color: '#fff',
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#f0c040',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1a3a6b',
  },
  section: {
    marginTop: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  optionBtnActive: {
    backgroundColor: '#f0c040',
    borderColor: '#f0c040',
  },
  optionText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#1a3a6b',
  },
  primaryBtn: {
    backgroundColor: '#f0c040',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#1a3a6b',
    fontWeight: '800',
    letterSpacing: 1,
  },
  waitingBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    padding: 24,
  },
  waitingLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  waitingCode: {
    color: '#f0c040',
    fontWeight: '800',
    letterSpacing: 8,
  },
  waitingHint: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    paddingVertical: 16,
    fontWeight: '700',
    letterSpacing: 12,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
