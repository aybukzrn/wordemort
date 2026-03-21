import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMode } from '../types/game';
import { useScale } from '../utils/useScale';

interface Props {
  onSelectMode: (mode: GameMode) => void;
}

interface ModeConfig {
  mode: GameMode;
  sourceLang: string;
  targetLang: string;
  title: string;
  description: string;
}

const MODES: ModeConfig[] = [
  {
    mode: 'TR',
    sourceLang: 'TR',
    targetLang: '',
    title: 'Türkçe',
    description: 'Türkçe kelimeleri bul',
  },
  {
    mode: 'TR_EN',
    sourceLang: 'TR',
    targetLang: 'EN',
    title: 'Türkçe → İngilizce',
    description: 'Türkçe kelimelerin İngilizce karşılıklarını bul',
  },
  {
    mode: 'EN_TR',
    sourceLang: 'EN',
    targetLang: 'TR',
    title: 'İngilizce → Türkçe',
    description: 'İngilizce kelimelerin Türkçe karşılıklarını bul',
  },
];

export function HomeScreen({ onSelectMode }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.round(32 * s) }]}>
        <Text style={[styles.title, { fontSize: Math.round(42 * s) }]}>Wordemort</Text>
        <Text style={[styles.subtitle, { fontSize: Math.round(15 * s) }]}>
          Mod seçerek oyuna başla
        </Text>
      </View>

      {/* Mode cards */}
      <View style={[styles.cards, { gap: Math.round(14 * s), paddingHorizontal: Math.round(24 * s) }]}>
        {MODES.map(cfg => (
          <TouchableOpacity
            key={cfg.mode}
            style={[styles.card, { borderRadius: Math.round(18 * s), padding: Math.round(20 * s) }]}
            activeOpacity={0.75}
            onPress={() => onSelectMode(cfg.mode)}>

            {/* Language badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgeSource, { borderRadius: Math.round(8 * s) }]}>
                <Text style={[styles.badgeText, { fontSize: Math.round(13 * s) }]}>
                  {cfg.sourceLang}
                </Text>
              </View>
              {cfg.targetLang ? (
                <>
                  <Text style={[styles.arrow, { fontSize: Math.round(16 * s) }]}>→</Text>
                  <View style={[styles.badge, styles.badgeTarget, { borderRadius: Math.round(8 * s) }]}>
                    <Text style={[styles.badgeText, { fontSize: Math.round(13 * s) }]}>
                      {cfg.targetLang}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Title + description */}
            <Text style={[styles.cardTitle, { fontSize: Math.round(20 * s), marginTop: Math.round(12 * s) }]}>
              {cfg.title}
            </Text>
            <Text style={[styles.cardDesc, { fontSize: Math.round(13 * s), marginTop: Math.round(4 * s) }]}>
              {cfg.description}
            </Text>

            {/* Play button */}
            <View style={[styles.playBtn, { borderRadius: Math.round(10 * s), marginTop: Math.round(16 * s), paddingVertical: Math.round(10 * s) }]}>
              <Text style={[styles.playBtnText, { fontSize: Math.round(14 * s) }]}>Oyna</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a3a6b',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
    fontWeight: '400',
  },
  cards: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeSource: {
    backgroundColor: '#f0c040',
  },
  badgeTarget: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontWeight: '800',
    color: '#1a3a6b',
    letterSpacing: 1,
  },
  arrow: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '300',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  playBtn: {
    backgroundColor: '#f0c040',
    alignItems: 'center',
  },
  playBtnText: {
    color: '#1a3a6b',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
