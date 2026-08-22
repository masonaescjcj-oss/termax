// @ts-nocheck
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { isTelegram } from '../config';

// NOTE: expo-blur BlurView is NOT used on native anymore.
// On Android, BlurView renders a gray fallback overlay instead of actual blur.
// Since our background is pure black (#000000), blurring black is meaningless.
// Using a plain View with identical rgba values as web produces pixel-perfect parity.

interface GlassViewProps {
  children?: React.ReactNode;
  style?: any;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  experimentalBlurMethod?: string;
  [key: string]: any;
}

export default function GlassView({
  children,
  style,
  intensity = 80,
  tint = 'dark',
  experimentalBlurMethod,
  ...props
}: GlassViewProps) {
  const isDark = tint === 'dark' || tint === 'default';
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const isWeb = Platform.OS === 'web';

  // --- Shared defaults (same values for both web and native) ---
  const defaultBg = isWeb
    ? (isDark ? 'rgba(10, 14, 23, 0.02)' : 'rgba(255, 255, 255, 0.08)')
    : (isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)');

  const defaultBorderColor = isDark 
    ? 'rgba(255, 255, 255, 0.08)' 
    : 'rgba(255, 255, 255, 0.25)'; 

  // --- Resolve background color ---
  let finalBg = defaultBg;
  if (flattenedStyle.backgroundColor) {
    const bgStr = String(flattenedStyle.backgroundColor).toLowerCase();
    if (bgStr.includes('rgba') || bgStr === 'transparent') {
      finalBg = flattenedStyle.backgroundColor;
    } else if (bgStr.includes('#') || bgStr.includes('rgb') || bgStr === 'black' || bgStr === 'white') {
      if (isWeb) {
        finalBg = defaultBg;
      } else {
        finalBg = flattenedStyle.backgroundColor;
      }
    }
  }

  // --- Resolve border color ---
  let finalBorderColor = defaultBorderColor;
  if (flattenedStyle.borderColor) {
    const borderColorStr = String(flattenedStyle.borderColor).toLowerCase();
    if (
      !borderColorStr.includes('rgba(255,255,255') && 
      !borderColorStr.includes('rgba(255, 255, 255') &&
      !borderColorStr.includes('rgba(0,0,0') &&
      borderColorStr !== '#fff' && 
      borderColorStr !== '#ffffff' &&
      borderColorStr !== 'white' &&
      borderColorStr !== '#000' &&
      borderColorStr !== '#000000' &&
      borderColorStr !== 'black' &&
      borderColorStr !== 'rgba(0, 0, 0, 0)' &&
      borderColorStr !== 'transparent'
    ) {
      finalBorderColor = flattenedStyle.borderColor;
    }
  }

  // For Web: Add CSS backdrop-filter (works natively in browsers)
  if (Platform.OS === 'web') {
    const webStyle = {
      backgroundColor: finalBg,
      borderColor: finalBorderColor,
      borderWidth: flattenedStyle.borderWidth !== undefined ? flattenedStyle.borderWidth : 1,
      backdropFilter: 'blur(35px) saturate(220%)',
      WebkitBackdropFilter: 'blur(35px) saturate(220%)',
      outlineStyle: 'none',
      overflow: 'hidden',
    };

    return (
      <View {...props} style={[flattenedStyle, webStyle]}>
        {children}
      </View>
    );
  }

  // For Android & iOS: Plain View with matching transparency + subtle gradient
  // No BlurView = no gray overlay artifact on Android
  const borderRadius = flattenedStyle.borderRadius !== undefined ? flattenedStyle.borderRadius : 16;
  const borderWidth = flattenedStyle.borderWidth !== undefined ? flattenedStyle.borderWidth : 1;
  const overflow = flattenedStyle.overflow || 'hidden';

  // Extract layout positioning styles for outer container
  const {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    position,
    top,
    bottom,
    left,
    right,
    flex,
    flexDirection,
    justifyContent,
    alignItems,
    width,
    height,
    alignSelf,
    zIndex,
    transform,
    padding,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingHorizontal,
    paddingVertical,
  } = flattenedStyle;

  const containerStyle = {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    position,
    top,
    bottom,
    left,
    right,
    flex,
    width,
    height,
    alignSelf,
    zIndex,
    transform,
    borderRadius,
    borderWidth,
    borderColor: finalBorderColor,
    overflow,
    backgroundColor: finalBg,
  };

  const contentStyle: any = {
    flexDirection,
    justifyContent,
    alignItems,
    padding,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingHorizontal,
    paddingVertical,
    backgroundColor: 'transparent',
  };

  if (width !== undefined) {
    contentStyle.width = '100%';
  }
  if (height !== undefined) {
    contentStyle.height = '100%';
  }

  // Only set flex on content if explicitly passed in style
  if (flex !== undefined) {
    contentStyle.flex = flex;
  }

  const showGradient = finalBg !== 'transparent';
  const glassGradientColors = isDark
    ? ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.0)']
    : ['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.0)'];

  return (
    <View style={containerStyle} {...props}>
      {showGradient && (
        <LinearGradient
          colors={glassGradientColors}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={contentStyle}>
        {children}
      </View>
    </View>
  );
}
