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
          <Text style={[styles.wordText, { fontSize: Math.round(20 * s) }]}>{currentWord}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    color: '#fff',
    lineHeight: 28,
  },
  wordArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  wordAreaActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  wordAreaWrong: {
    backgroundColor: 'rgba(220,60,60,0.5)',
  },
  wordText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 4,
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#d4a017',
    gap: 4,
  },
  hintIcon: {
    color: '#fff',
    fontWeight: '800',
  },
  hintCount: {
    color: '#fff',
    fontWeight: '700',
  },
});
