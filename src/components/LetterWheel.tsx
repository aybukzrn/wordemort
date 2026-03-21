import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useScale } from '../utils/useScale';

interface Props {
  letters: string[];
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  onWordSubmit: (word: string) => void;
}

export function LetterWheel({
  letters,
  selectedIndices,
  onSelectionChange,
  onWordSubmit,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const s = useScale();

  // Cap wheel size so it never exceeds the screen width with some padding
  const wheelSize = Math.min(Math.round(300 * s), screenWidth - 32);
  const letterRadius = Math.round(28 * s);
  const hitRadius = letterRadius + Math.round(10 * s);

  const containerRef = useRef<View>(null);
  const pagePos = useRef({ x: 0, y: 0 });
  const currentIndices = useRef<number[]>([]);

  // Use refs so PanResponder always has fresh values
  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onWordSubmitRef = useRef(onWordSubmit);
  onWordSubmitRef.current = onWordSubmit;

  // Keep sizing in refs so PanResponder callbacks always read fresh values
  const wheelSizeRef = useRef(wheelSize);
  wheelSizeRef.current = wheelSize;
  const letterRadiusRef = useRef(letterRadius);
  letterRadiusRef.current = letterRadius;
  const hitRadiusRef = useRef(hitRadius);
  hitRadiusRef.current = hitRadius;

  const orbitRadius =
    letters.length <= 4
      ? wheelSize / 2 - letterRadius - Math.round(28 * s)
      : wheelSize / 2 - letterRadius - Math.round(18 * s);

  const letterPositions = useMemo(() => {
    const ws = wheelSizeRef.current;
    const lr = letterRadiusRef.current;
    const orbit =
      letters.length <= 4
        ? ws / 2 - lr - Math.round(28 * s)
        : ws / 2 - lr - Math.round(18 * s);
    return letters.map((_, i) => {
      const angle = (2 * Math.PI * i) / letters.length - Math.PI / 2;
      return {
        x: ws / 2 + orbit * Math.cos(angle),
        y: ws / 2 + orbit * Math.sin(angle),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters.length, orbitRadius]);

  const letterPositionsRef = useRef(letterPositions);
  letterPositionsRef.current = letterPositions;

  const getLetterIndex = useCallback((touchX: number, touchY: number): number => {
    const positions = letterPositionsRef.current;
    const hr = hitRadiusRef.current;
    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      const dist = Math.sqrt((touchX - x) ** 2 + (touchY - y) ** 2);
      if (dist <= hr) return i;
    }
    return -1;
  }, []);

  const handleLayout = useCallback(() => {
    containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      pagePos.current = { x: pageX, y: pageY };
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: e => {
        const touchX = e.nativeEvent.pageX - pagePos.current.x;
        const touchY = e.nativeEvent.pageY - pagePos.current.y;
        const idx = getLetterIndex(touchX, touchY);
        const newIndices = idx >= 0 ? [idx] : [];
        currentIndices.current = newIndices;
        onSelectionChangeRef.current([...newIndices]);
      },

      onPanResponderMove: e => {
        const touchX = e.nativeEvent.pageX - pagePos.current.x;
        const touchY = e.nativeEvent.pageY - pagePos.current.y;
        const idx = getLetterIndex(touchX, touchY);

        if (idx < 0) return;

        const current = currentIndices.current;

        if (current.length >= 2 && current[current.length - 2] === idx) {
          const newIndices = current.slice(0, -1);
          currentIndices.current = newIndices;
          onSelectionChangeRef.current([...newIndices]);
          return;
        }

        if (!current.includes(idx)) {
          const newIndices = [...current, idx];
          currentIndices.current = newIndices;
          onSelectionChangeRef.current(newIndices);
        }
      },

      onPanResponderRelease: () => {
        const indices = currentIndices.current;
        if (indices.length > 0) {
          const word = indices.map(i => lettersRef.current[i]).join('');
          onWordSubmitRef.current(word);
        }
        currentIndices.current = [];
        onSelectionChangeRef.current([]);
      },

      onPanResponderTerminate: () => {
        currentIndices.current = [];
        onSelectionChangeRef.current([]);
      },
    }),
  ).current;

  // Connection lines between consecutive selected letters
  const lines = useMemo(() => {
    const result: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < selectedIndices.length - 1; i++) {
      const a = letterPositions[selectedIndices[i]];
      const b = letterPositions[selectedIndices[i + 1]];
      if (a && b) result.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return result;
  }, [selectedIndices, letterPositions]);

  const lineHeight = Math.round(6 * s);

  return (
    <View
      ref={containerRef}
      style={[styles.container, { width: wheelSize, height: wheelSize }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}>

      {/* Connection lines */}
      {lines.map((line, i) => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const cx = (line.x1 + line.x2) / 2;
        const cy = (line.y1 + line.y2) / 2;
        return (
          <View
            key={i}
            style={[
              styles.line,
              {
                height: lineHeight,
                borderRadius: lineHeight / 2,
                width: length,
                left: cx - length / 2,
                top: cy - lineHeight / 2,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}

      {/* Letter circles */}
      {letters.map((letter, i) => {
        const pos = letterPositions[i];
        const isSelected = selectedIndices.includes(i);
        return (
          <View
            key={i}
            style={[
              styles.letterCircle,
              {
                left: pos.x - letterRadius,
                top: pos.y - letterRadius,
                width: letterRadius * 2,
                height: letterRadius * 2,
                borderRadius: letterRadius,
                backgroundColor: isSelected ? '#f0c040' : '#fff',
                transform: [{ scale: isSelected ? 1.15 : 1 }],
              },
            ]}>
            <Text style={[styles.letterText, { fontSize: Math.round(18 * s) }, isSelected && styles.letterTextSelected]}>
              {letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  line: {
    position: 'absolute',
    backgroundColor: 'rgba(240,192,64,0.7)',
  },
  letterCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  letterText: {
    fontWeight: '700',
    color: '#1a3a6b',
  },
  letterTextSelected: {
    color: '#333',
  },
});
