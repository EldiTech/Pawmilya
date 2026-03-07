import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * JemoyIcon — Displays the Jemoy brown husky mascot image.
 *
 * @param {number} size - overall diameter (default 40)
 */
const JEMOY_IMG = require('../../assets/jemoy.png');

const JemoyIcon = memo(({ size = 40 }) => (
  <Image
    source={JEMOY_IMG}
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
    }}
    resizeMode="cover"
  />
));

export default JemoyIcon;
