import React from 'react';
import { Text as RNText, TextProps, TextInput as RNTextInput, TextInputProps, StyleSheet, Platform } from 'react-native';

const getCustomStyle = (styleProp: any) => {
  const defaultFont = (global as any).activeAppFont || (Platform.OS !== 'web' ? 'Righteous' : 'Montserrat');
  const flattenedStyle = StyleSheet.flatten(styleProp || {}) as any;
  
  const isSpecial = flattenedStyle.fontFamily && ['monospace', 'serif', 'sans-serif'].includes(flattenedStyle.fontFamily);
  let finalFontFamily = isSpecial ? flattenedStyle.fontFamily : (flattenedStyle.fontFamily || defaultFont);
  
  if (finalFontFamily === 'Montserrat' && !isSpecial) {
    const weight = flattenedStyle.fontWeight;
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
      finalFontFamily = 'Montserrat-Bold';
    } else if (weight === '500' || weight === '600' || weight === 'semibold' || weight === 'medium') {
      finalFontFamily = 'Montserrat-SemiBold';
    } else {
      finalFontFamily = 'Montserrat-Regular';
    }
  }
  
  const updatedStyle = { ...flattenedStyle };
  if (finalFontFamily) {
    updatedStyle.fontFamily = finalFontFamily;
  }
  
  // On Android, custom fonts fail and revert to system default if combined with fontWeight (e.g. bold, 700, 800)
  // Stripping fontWeight on Android ensures 100% of texts render with the chosen custom font family!
  const isCustomFont = finalFontFamily && !['System', 'sans-serif', 'serif', 'monospace'].includes(finalFontFamily);
  if (Platform.OS === 'android' && isCustomFont && !isSpecial) {
    delete updatedStyle.fontWeight;
    delete updatedStyle.fontStyle;
  }
  
  return updatedStyle;
};

export const Text = React.forwardRef<RNText, TextProps>((props, ref) => {
  return <RNText ref={ref} {...props} style={getCustomStyle(props.style)} />;
});

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  return <RNTextInput ref={ref} {...props} style={getCustomStyle(props.style)} />;
});
