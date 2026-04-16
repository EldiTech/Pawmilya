import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants/theme';

const SIZE_MAP = {
  small: { icon: 20, text: 14, badge: 38 },
  medium: { icon: 28, text: 18, badge: 52 },
  large: { icon: 40, text: 24, badge: 72 },
};

const Logo = ({ size = 'medium', showText = false }) => {
  const token = SIZE_MAP[size] || SIZE_MAP.medium;

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { width: token.badge, height: token.badge, borderRadius: token.badge / 2 }]}>
        <MaterialCommunityIcons name="paw" size={token.icon} color={COLORS.primary} />
      </View>
      {showText ? <Text style={[styles.text, { fontSize: token.text }]}>Pawmilya</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.brown,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default memo(Logo);
