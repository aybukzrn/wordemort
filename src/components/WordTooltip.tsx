import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';

interface Props {
  word: string;       // boş string → henüz bulunmamış kelime
  meaning: string;
  onDismiss: () => void;
}

export function WordTooltip({ word, meaning, onDismiss }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  // Spring ile aç
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  // Kapanırken önce animate et, sonra parent'a haber ver
  const handleDismiss = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [anim, onDismiss]);

  const cardStyle = {
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
    ],
  };

  const isRevealed = word.length > 0;

  return (
    <TouchableWithoutFeedback onPress={handleDismiss}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.word}>
              {isRevealed ? word : '?????'}
            </Text>
            <Text style={styles.meaning}>
              {meaning || (isRevealed ? 'Anlam bulunamadı' : 'Bu kelimeyi bulmaya çalış!')}
            </Text>
            <View style={styles.arrow} />
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  card: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  word: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a6bbf',
    marginBottom: 6,
  },
  meaning: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  arrow: {
    position: 'absolute',
    bottom: -10,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },
});
