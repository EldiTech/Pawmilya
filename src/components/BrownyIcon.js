import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * BrownyIcon — a cute dog face icon built entirely from
 * React Native <View> shapes (no SVG dependency needed).
 *
 * @param {number} size - overall diameter (default 40)
 */
const BrownyIcon = memo(({ size = 40 }) => {
  const s = size / 40; // scale factor based on 40px baseline

  return (
    <View style={[ico.wrap, { width: size, height: size }]}>

      {/* ── Ears ─────────────────────────── */}
      <View style={[ico.ear, ico.earL, {
        width: 14 * s, height: 18 * s,
        borderRadius: 7 * s,
        top: -2 * s, left: 3 * s,
      }]} />
      <View style={[ico.ear, ico.earR, {
        width: 14 * s, height: 18 * s,
        borderRadius: 7 * s,
        top: -2 * s, right: 3 * s,
      }]} />

      {/* ── Ear inners ───────────────────── */}
      <View style={[ico.earInner, {
        width: 8 * s, height: 10 * s,
        borderRadius: 4 * s,
        top: 2 * s, left: 6 * s,
      }]} />
      <View style={[ico.earInner, {
        width: 8 * s, height: 10 * s,
        borderRadius: 4 * s,
        top: 2 * s, right: 6 * s,
      }]} />

      {/* ── Head / face circle ───────────── */}
      <View style={[ico.face, {
        width: 30 * s, height: 28 * s,
        borderRadius: 14 * s,
        top: 6 * s,
      }]} />

      {/* ── Muzzle (lighter oval) ────────── */}
      <View style={[ico.muzzle, {
        width: 18 * s, height: 13 * s,
        borderRadius: 9 * s,
        bottom: 3 * s,
      }]} />

      {/* ── Eyes ─────────────────────────── */}
      <View style={[ico.eye, {
        width: 5 * s, height: 5.5 * s,
        borderRadius: 3 * s,
        top: 15 * s, left: 10 * s,
      }]} />
      <View style={[ico.eye, {
        width: 5 * s, height: 5.5 * s,
        borderRadius: 3 * s,
        top: 15 * s, right: 10 * s,
      }]} />

      {/* ── Eye shines ───────────────────── */}
      <View style={[ico.shine, {
        width: 2 * s, height: 2 * s,
        borderRadius: 1 * s,
        top: 15.5 * s, left: 11 * s,
      }]} />
      <View style={[ico.shine, {
        width: 2 * s, height: 2 * s,
        borderRadius: 1 * s,
        top: 15.5 * s, right: 11 * s,
      }]} />

      {/* ── Nose ─────────────────────────── */}
      <View style={[ico.nose, {
        width: 7 * s, height: 5 * s,
        borderRadius: 3.5 * s,
        top: 21 * s,
      }]} />

      {/* ── Nose shine ───────────────────── */}
      <View style={[ico.noseShine, {
        width: 2.5 * s, height: 1.5 * s,
        borderRadius: 1 * s,
        top: 21.5 * s,
        left: 18 * s,
      }]} />

      {/* ── Mouth ────────────────────────── */}
      <View style={[ico.mouthLine, {
        width: 1 * s, height: 4 * s,
        top: 25.5 * s,
      }]} />
      <View style={[ico.mouthCurve, ico.mouthL, {
        width: 5 * s, height: 5 * s,
        borderRadius: 5 * s,
        borderWidth: 1 * s,
        top: 27 * s, left: 13 * s,
      }]} />
      <View style={[ico.mouthCurve, ico.mouthR, {
        width: 5 * s, height: 5 * s,
        borderRadius: 5 * s,
        borderWidth: 1 * s,
        top: 27 * s, right: 13 * s,
      }]} />

      {/* ── Cheek blushes ────────────────── */}
      <View style={[ico.blush, {
        width: 5 * s, height: 3 * s,
        borderRadius: 2 * s,
        top: 22 * s, left: 5 * s,
      }]} />
      <View style={[ico.blush, {
        width: 5 * s, height: 3 * s,
        borderRadius: 2 * s,
        top: 22 * s, right: 5 * s,
      }]} />
    </View>
  );
});

const ico = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'visible',
  },

  // Ears
  ear: {
    position: 'absolute',
    backgroundColor: '#C47A3A',
    zIndex: 0,
  },
  earL: { transform: [{ rotate: '-15deg' }] },
  earR: { transform: [{ rotate: '15deg' }] },
  earInner: {
    position: 'absolute',
    backgroundColor: '#E8A76E',
    zIndex: 1,
  },

  // Head
  face: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#D4892E',
    zIndex: 2,
  },

  // Muzzle
  muzzle: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#F5D5A8',
    zIndex: 3,
  },

  // Eyes
  eye: {
    position: 'absolute',
    backgroundColor: '#3D2314',
    zIndex: 4,
  },

  // Eye highlights
  shine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },

  // Nose
  nose: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#3D2314',
    zIndex: 5,
  },
  noseShine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
    zIndex: 6,
  },

  // Mouth
  mouthLine: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#7A4B28',
    zIndex: 4,
  },
  mouthCurve: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderBottomColor: '#7A4B28',
    zIndex: 4,
  },
  mouthL: { borderRightColor: '#7A4B28' },
  mouthR: { borderLeftColor: '#7A4B28' },

  // Cheek blush
  blush: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 149, 84, 0.30)',
    zIndex: 4,
  },
});

export default BrownyIcon;
