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
  onMultiplayer: () => void;
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

export function HomeScreen({ onSelectMode, onMultiplayer }: Props) {
  const insets = useSafeAreaInsets();
  const s = useScale();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header paper panel */}
      <View style={[styles.headerPanel, { marginTop: Math.round(24 * s), marginHorizontal: Math.round(24 * s), borderRadius: Math.round(8 * s), paddingVertical: Math.round(18 * s) }]}>
        <Text style={[styles.title, { fontSize: Math.round(38 * s) }]}>WORDEMORT</Text>
        <Text style={[styles.subtitle, { fontSize: Math.round(13 * s) }]}>
          Mod seçerek oyuna başla
        </Text>
      </View>

      {/* Multiplayer button */}
      <View style={[styles.multiBtnWrapper, { marginHorizontal: Math.round(24 * s), marginTop: Math.round(18 * s), borderRadius: Math.round(10 * s) }]}>
        <TouchableOpacity
          style={[styles.multiBtn, { borderRadius: Math.round(10 * s), paddingVertical: Math.round(14 * s), paddingHorizontal: Math.round(18 * s) }]}
          activeOpacity={0.85}
          onPress={onMultiplayer}>
          <View style={styles.multiBtnRow}>
            <View style={[styles.multiBtnBadge, { borderRadius: Math.round(6 * s), paddingHorizontal: Math.round(8 * s), paddingVertical: Math.round(3 * s) }]}>
              <Text style={[styles.multiBtnBadgeText, { fontSize: Math.round(11 * s) }]}>ÇEVRİMİÇİ</Text>
            </View>
            <Text style={[styles.multiBtnText, { fontSize: Math.round(17 * s) }]}>Çok Oyunculu</Text>
            <Text style={[styles.playArrow, { fontSize: Math.round(22 * s) }]}>▶</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Mode cards */}
      <View style={[styles.cards, { gap: Math.round(12 * s), paddingHorizontal: Math.round(24 * s), marginTop: Math.round(14 * s) }]}>
        {MODES.map((cfg, idx) => {
          const btnColors = [
            { bg: '#2e8040', shadow: '#1a5228' },
            { bg: '#c47a15', shadow: '#8f5800' },
            { bg: '#a83030', shadow: '#6e1a1a' },
          ];
          const color = btnColors[idx % btnColors.length];
          return (
            <View key={cfg.mode} style={[styles.cardShadow, { borderRadius: Math.round(10 * s), backgroundColor: color.shadow }]}>
              <TouchableOpacity
                style={[styles.card, { borderRadius: Math.round(10 * s), backgroundColor: color.bg, paddingVertical: Math.round(14 * s), paddingHorizontal: Math.round(18 * s) }]}
                activeOpacity={0.85}
                onPress={() => onSelectMode(cfg.mode)}>

                <View style={styles.cardRow}>
                  {/* Language badges */}
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { borderRadius: Math.round(6 * s), paddingHorizontal: Math.round(8 * s), paddingVertical: Math.round(3 * s) }]}>
                      <Text style={[styles.badgeText, { fontSize: Math.round(12 * s) }]}>
                        {cfg.sourceLang}
                      </Text>
                    </View>
                    {cfg.targetLang ? (
                      <>
                        <Text style={[styles.arrow, { fontSize: Math.round(14 * s) }]}>→</Text>
                        <View style={[styles.badge, styles.badgeTarget, { borderRadius: Math.round(6 * s), paddingHorizontal: Math.round(8 * s), paddingVertical: Math.round(3 * s) }]}>
                          <Text style={[styles.badgeText, { fontSize: Math.round(12 * s) }]}>
                            {cfg.targetLang}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Title + description */}
                  <View style={styles.cardTextGroup}>
                    <Text style={[styles.cardTitle, { fontSize: Math.round(16 * s) }]}>
                      {cfg.title}
                    </Text>
                    <Text style={[styles.cardDesc, { fontSize: Math.round(11 * s) }]}>
                      {cfg.description}
                    </Text>
                  </View>

                  {/* Arrow indicator */}
                  <Text style={[styles.playArrow, { fontSize: Math.round(22 * s) }]}>▶</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#2d2926',
  },
  headerPanel: {
    backgroundColor: '#f2e8d0',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#c4a870',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  title: {
    color: '#2a1a08',
    fontWeight: '900',
    letterSpacing: 3,
  },
  subtitle: {
    color: '#7a5a30',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  multiBtnWrapper: {
    backgroundColor: '#1a5228',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  multiBtn: {
    backgroundColor: '#2e8040',
    alignItems: 'center',
    marginBottom: 4,
  },
  multiBtnLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  multiBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  multiBtnBadge: {
    backgroundColor: '#f2e8d0',
  },
  multiBtnBadgeText: {
    fontWeight: '800',
    color: '#2a1a08',
    letterSpacing: 1,
  },
  multiBtnText: {
    flex: 1,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cards: {
    flex: 1,
    justifyContent: 'center',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  card: {
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    backgroundColor: '#f2e8d0',
  },
  badgeTarget: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    fontWeight: '800',
    color: '#2a1a08',
    letterSpacing: 1,
  },
  arrow: {
    color: 'rgba(255,255,255,0.6)',
  },
  cardTextGroup: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  playArrow: {
    color: 'rgba(255,255,255,0.5)',
  },
});
