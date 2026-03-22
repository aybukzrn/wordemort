import { io, Socket } from 'socket.io-client';
import { GameMode } from '../types/game';

//const SERVER_URL = 'http://192.168.1.103:3001';
const SERVER_URL = 'http://Aybuke-MacBook-Air.local:3001';

// ─── Payload types (mirrors backend types) ───────────────────────────────────

export interface RoomCreatedPayload {
  code: string;
  seed: number;
  levelNum: number;
  mode: GameMode;
  totalLevels: number;
}

export interface JoinSuccessPayload {
  code: string;
  opponentName: string;
  mode: GameMode;
  totalLevels: number;
  seed: number;
  levelNum: number;
}

export interface WordAcceptedPayload {
  word: string;
  myScore: number;
}

export interface OpponentWordPayload {
  word: string;
  opponentScore: number;
}

export interface LevelCompletePayload {
  myScore: number;
  opponentScore: number;
  levelNum: number;
}

export interface LevelStartPayload {
  seed: number;
  levelNum: number;
}

export interface GameOverPayload {
  myScore: number;
  opponentScore: number;
  result: 'win' | 'lose' | 'draw';
}

// ─── Singleton socket ─────────────────────────────────────────────────────────

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    _socket = io(SERVER_URL, { transports: ['websocket'] });
  }
  return _socket;
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export function createRoom(payload: { mode: GameMode; totalLevels: number; playerName: string }) {
  getSocket().emit('create_room', payload);
}

export function joinRoom(payload: { code: string; playerName: string }) {
  getSocket().emit('join_room', payload);
}

export function sendWordFound(payload: { word: string; totalWordsInLevel: number }) {
  getSocket().emit('word_found', payload);
}

export function leaveRoom() {
  getSocket().emit('leave_room');
}
