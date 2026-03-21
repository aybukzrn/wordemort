import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useScale } from '../utils/useScale';

interface Props {
  level: number;
  hints: number;
  onHint: () => void;
  onSettings: () => void;
}

export function GameHeader({ level, hints, onHint, onSettings }: Props) {
  const s = useScale();
  const btnSize = Math.round(44 * s);

  return (
    <View style={[styles.container, { paddingHorizontal: Math.round(16 * s), paddingVertical: Math.round(12 * s) }]}>
      <TouchableOpacity
        style={[styles.settingsBtn, { width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]}
        onPress={onSettings}>
        <Text style={[styles.settingsIcon, { fontSize: Math.round(22 * s) }]}>{'\u2699'}</Text>
      </TouchableOpacity>

      <View style={[styles.levelBadge, { paddingHorizontal: Math.round(20 * s), paddingVertical: Math.round(8 * s) }]}>
        <Text style={[styles.levelText, { fontSize: Math.round(16 * s) }]}>Seviye {level}</Text>
      </View>

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
  levelBadge: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  levelText: {
    color: '#fff',
    fontWeight: '600',
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
