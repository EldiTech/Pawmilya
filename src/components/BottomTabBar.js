import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

const tabs = [
  { id: 'home', label: 'Home', iconSet: 'ionicons', icon: 'home', iconOutline: 'home-outline' },
  { id: 'pets', label: 'Pets', iconSet: 'material', icon: 'paw', iconOutline: 'paw-outline' },
  { id: 'rescue', label: 'Rescue', iconSet: 'fontawesome', icon: 'hand-holding-heart' },
  { id: 'mission', label: 'Mission', iconSet: 'ionicons', icon: 'star', iconOutline: 'star-outline' },
  { id: 'login', label: 'Login', iconSet: 'ionicons', icon: 'log-in', iconOutline: 'log-in-outline' },
];

const TabIcon = memo(({ tab, isActive }) => {
  const color = isActive ? COLORS.primary : COLORS.textLight;
  const size = 22;
  const iconName = isActive ? tab.icon : (tab.iconOutline || tab.icon);

  switch (tab.iconSet) {
    case 'ionicons':
      return <Ionicons name={iconName} size={size} color={color} />;
    case 'material':
      return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
    case 'fontawesome':
      return <FontAwesome5 name={tab.icon} size={size - 2} color={color} solid={isActive} />;
    default:
      return null;
  }
});

TabIcon.displayName = 'TabIcon';

const BottomTabBar = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
              <TabIcon tab={tab} isActive={isActive} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: RADIUS.xxl + 4,
    borderTopRightRadius: RADIUS.xxl + 4,
    elevation: 20,
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconContainerActive: {
    backgroundColor: COLORS.backgroundLight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: FONTS.sizes.sm - 2,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.medium,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
  indicator: {
    position: 'absolute',
    bottom: -2,
    width: 28,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});

export default memo(BottomTabBar);
