import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';

const Logo = ({ size = 'medium' }) => {
  const dimensions = {
    small: { outer: 36, inner: 28, icon: 18 },
    medium: { outer: 44, inner: 34, icon: 22 },
    large: { outer: 56, inner: 44, icon: 28 },
  };

  const { outer, inner, icon } = dimensions[size] || dimensions.medium;

  return (
    <View style={[styles.outerRing, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View style={[styles.innerCircle, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <MaterialCommunityIcons name="paw" size={icon} color={COLORS.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  innerCircle: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(Logo);
