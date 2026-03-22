import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useScale } from '../utils/useScale';

interface Props {
  currentWord: string;
  isWrong: boolean;
  shakeAnim: Animated.Value;
  hints: number;
  onHint: () => void;
  onSettings: () => void;
}

export function GameHeader({ currentWord, isWrong, shakeAnim, hints, onHint, onSettings }: Props) {
  const s = useScale();
  const btnSize = Math.round(44 * s);

  return (
    <View style={[styles.container, { paddingHorizontal: Math.round(16 * s), paddingVertical: Math.round(12 * s) }]}>
      <TouchableOpacity
        style={[styles.settingsBtn, { width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]}
        onPress={onSettings}>
        <Text style={[styles.settingsIcon, { fontSize: Math.round(22 * s), lineHeight: Math.round(28 * s) }]}>{'\u2699'}</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.wordArea,
          { minWidth: Math.round(80 * s), paddingHorizontal: Math.round(20 * s), paddingVertical: Math.round(8 * s), borderRadius: Math.round(16 * s) },
          currentWord.length > 0 && (isWrong ? styles.wordAreaWrong : styles.wordAreaActive),
          { transform: [{ translateX: shakeAnim }] },
        ]}>
        {currentWord.length > 0 && (
          <Text style={[styles.wordText, isWrong && styles.wordTextWrong, { fontSize: Math.round(20 * s) }]}>{currentWord}</Text>
        )}
      </Animated.View>

      <TouchableOpacity
        style={[styles.hintBtn, { paddingHorizontal: Math.round(14 * s), paddingVertical: Math.round(8 * s) }]}
        onPress={onHint}>
        <Text style={[styles.hintIcon, { fontSize: Math.round(16 * s) }]}>?</Text>
        <Text style={[styles.hintCount, { fontSize: Math.round(16 * s) }]}>{hints}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsBtn: {
    backgroundColor: '#4a3a2a',
    borderWidth: 2,
    borderColor: '#2a1a0a',
    borderBottomWidth: 4,
    borderBottomColor: '#1a0a00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    color: '#f2e8d0',
    lineHeight: 28,
  },
  wordArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderRadius: 8,
  },
  wordAreaActive: {
    backgroundColor: '#f2e8d0',
    borderBottomWidth: 3,
    borderBottomColor: '#c4a870',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  wordAreaWrong: {
    backgroundColor: '#b83030',
    borderBottomWidth: 3,
    borderBottomColor: '#7a1f1f',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  wordText: {
    color: '#2a1a08',
    fontWeight: '800',
    letterSpacing: 4,
  },
  wordTextWrong: {
    color: '#fff',
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#c47a15',
    borderBottomWidth: 4,
    borderBottomColor: '#8f5800',
    gap: 4,
  },
  hintIcon: {
    color: '#fff',
    fontWeight: '900',
  },
  hintCount: {
    color: '#fff',
    fontWeight: '800',
  },
});
