import React, { useRef, useCallback, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useScale } from '../utils/useScale';

export interface LetterWheelRef {
  getLetterCenterAbsolute: (index: number) => { x: number; y: number };
  getLetterRadius: () => number;
}

interface Props {
  letters: string[];
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  onWordSubmit: (word: string) => void;
  levelKey: number;
  maxSize?: number;
}

export const LetterWheel = forwardRef<LetterWheelRef, Props>(function LetterWheel(
  { letters, selectedIndices, onSelectionChange, onWordSubmit, levelKey, maxSize },
  ref,
) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const s = useScale();

  const wheelSize = Math.min(
    Math.round(300 * s),
    screenWidth - 32,
    maxSize ?? Math.round(screenHeight * 0.34),
  );

  // Orbit radius (distance from center to letter circle center)
  const baseOrbitGap = letters.length <= 4 ? Math.round(28 * s) : Math.round(18 * s);
  // Compute the max letter radius that fits on the orbit without overlapping
  // arc distance between letters = 2π * orbitRadius / n >= 2 * letterRadius
  // orbitRadius = wheelSize/2 - letterRadius - baseOrbitGap
  // Solving: letterRadius * (n + π) <= π * (wheelSize/2 - baseOrbitGap)
  const maxLetterRadius = Math.floor(
    (Math.PI * (wheelSize / 2 - baseOrbitGap)) / (letters.length + Math.PI),
  );
  const letterRadius = Math.min(Math.round(28 * s), maxLetterRadius);
  const hitRadius = letterRadius + Math.round(8 * s);

  const orbitRadius = wheelSize / 2 - letterRadius - baseOrbitGap;

  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null);
  const setFingerPosRef = useRef(setFingerPos);
  setFingerPosRef.current = setFingerPos;

  const containerRef = useRef<View>(null);
  const pagePos = useRef({ x: 0, y: 0 });
  const currentIndices = useRef<number[]>([]);

  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onWordSubmitRef = useRef(onWordSubmit);
  onWordSubmitRef.current = onWordSubmit;

  const letterRadiusRef = useRef(letterRadius);
  letterRadiusRef.current = letterRadius;
  const hitRadiusRef = useRef(hitRadius);
  hitRadiusRef.current = hitRadius;

  const letterPositions = useMemo(() => {
    const ws = wheelSize;
    const lr = letterRadius;
    const orb = ws / 2 - lr - baseOrbitGap;
    return letters.map((_, i) => {
      const angle = (2 * Math.PI * i) / letters.length - Math.PI / 2;
      return {
        x: ws / 2 + orb * Math.cos(angle),
        y: ws / 2 + orb * Math.sin(angle),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters.length, orbitRadius]);

  const letterPositionsRef = useRef(letterPositions);
  letterPositionsRef.current = letterPositions;

  useImperativeHandle(ref, () => ({
    getLetterCenterAbsolute: (index: number) => {
      const pos = letterPositionsRef.current[index];
      if (!pos) return { x: 0, y: 0 };
      return {
        x: pagePos.current.x + pos.x,
        y: pagePos.current.y + pos.y,
      };
    },
    getLetterRadius: () => letterRadiusRef.current,
  }));

  // ─── Entrance animations ────────────────────────────────────────────────────
  const entranceAnims = useRef<Animated.Value[]>([]);
  const prevLevelKeyRef = useRef(-1);

  while (entranceAnims.current.length < letters.length) {
    entranceAnims.current.push(new Animated.Value(0));
  }

  useEffect(() => {
    if (levelKey === prevLevelKeyRef.current) return;
    prevLevelKeyRef.current = levelKey;

    letters.forEach((_, i) => {
      const anim = entranceAnims.current[i];
      anim.setValue(0);
      setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 180,
          useNativeDriver: true,
        }).start();
      }, i * 55);
    });
  }, [levelKey, letters]);

  // ─── Gesture ────────────────────────────────────────────────────────────────
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
        setFingerPosRef.current({ x: touchX, y: touchY });
      },

      onPanResponderMove: e => {
        const touchX = e.nativeEvent.pageX - pagePos.current.x;
        const touchY = e.nativeEvent.pageY - pagePos.current.y;
        setFingerPosRef.current({ x: touchX, y: touchY });
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
        setFingerPosRef.current(null);
      },

      onPanResponderTerminate: () => {
        currentIndices.current = [];
        onSelectionChangeRef.current([]);
        setFingerPosRef.current(null);
      },
    }),
  ).current;

  // ─── Connection lines ───────────────────────────────────────────────────────
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

      {/* Live trailing line: last selected letter → finger */}
      {fingerPos && selectedIndices.length > 0 && (() => {
        const last = letterPositions[selectedIndices[selectedIndices.length - 1]];
        if (!last) return null;
        const dx = fingerPos.x - last.x;
        const dy = fingerPos.y - last.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 2) return null;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const cx = (last.x + fingerPos.x) / 2;
        const cy = (last.y + fingerPos.y) / 2;
        return (
          <View
            style={[
              styles.line,
              styles.lineLive,
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
      })()}

      {/* Letter circles */}
      {letters.map((letter, i) => {
        const pos = letterPositions[i];
        const isSelected = selectedIndices.includes(i);
        const entranceAnim = entranceAnims.current[i];

        const entranceScale = entranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.2, 1],
        });
        const entranceOpacity = entranceAnim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 1],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
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
                opacity: entranceOpacity,
                transform: [
                  { scale: entranceScale },
                  { scale: isSelected ? 1.15 : 1 },
                ],
              },
            ]}>
            <Text
              style={[
                styles.letterText,
                { fontSize: Math.round(letterRadius * 0.65) },
                isSelected && styles.letterTextSelected,
              ]}>
              {letter}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  line: {
    position: 'absolute',
    backgroundColor: 'rgba(240,192,64,0.7)',
  },
  lineLive: {
    backgroundColor: 'rgba(240,192,64,0.4)',
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
