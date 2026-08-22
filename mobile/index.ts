// @ts-nocheck
// Polyfills are loaded via entry.js -> polyfills.js BEFORE this file
import { registerRootComponent } from 'expo';
import { Text, TextInput } from 'react-native';
import React from 'react';

// Global font state
global.activeAppFont = 'Montserrat';

let fontChangeCallback = null;
global.registerFontChangeCallback = (cb) => {
  fontChangeCallback = cb;
};
global.triggerFontChange = () => {
  if (fontChangeCallback) {
    fontChangeCallback();
  }
};

// Safely patch React component creation
const RN = require('react-native');

const isTextComponent = (type) => {
  if (!type) return false;
  
  // Only patch standard Text components.
  // We do NOT patch TextInput to avoid focus loss, keyboard auto-dismissal,
  // and focus-jumping bugs on Android.
  if (type === RN.Text) {
    return true;
  }

  const name = type.displayName || type.name;
  return name === 'Text';
};

const patchProps = (type, props) => {
  if (isTextComponent(type)) {
    let resolvedFont = global.activeAppFont;

    if (props) {
      let flattenedStyle = {};
      try {
        const { StyleSheet } = require('react-native');
        flattenedStyle = StyleSheet.flatten(props.style) || {};
      } catch (e) {}

      // Respect monospace if explicitly requested
      if (flattenedStyle.fontFamily === 'monospace') {
        resolvedFont = 'monospace';
      }

      const isSpecial = resolvedFont === 'monospace' || resolvedFont === 'serif' || resolvedFont === 'sans-serif';

      if (RN.Platform.OS === 'android' && !isSpecial) {
        const cleanStyle = { ...flattenedStyle, fontFamily: resolvedFont };
        delete cleanStyle.fontWeight;
        delete cleanStyle.fontStyle;
        return {
          ...props,
          style: cleanStyle
        };
      }

      return {
        ...props,
        style: [props.style, { fontFamily: resolvedFont }]
      };
    } else {
      return { style: { fontFamily: resolvedFont } };
    }
  }
  return props;
};

// 1. Patch React.createElement
const originalCreateElement = React.createElement;
React.createElement = function(type, props, ...children) {
  const patchedProps = patchProps(type, props);
  return originalCreateElement.call(this, type, patchedProps, ...children);
};

// 2. Patch react/jsx-runtime
const patchJsxRuntime = (modulePath, exportNames) => {
  try {
    let runtime;
    if (modulePath === 'react/jsx-runtime') {
      runtime = require('react/jsx-runtime');
    } else if (modulePath === 'react/jsx-dev-runtime') {
      runtime = require('react/jsx-dev-runtime');
    } else {
      return;
    }
    exportNames.forEach(name => {
      const original = runtime[name];
      if (original) {
        runtime[name] = function(type, props, ...rest) {
          const patchedProps = patchProps(type, props);
          return original.call(this, type, patchedProps, ...rest);
        };
      }
    });
  } catch (e) {
    console.warn(`Failed to patch ${modulePath}:`, e);
  }
};

patchJsxRuntime('react/jsx-runtime', ['jsx', 'jsxs']);
patchJsxRuntime('react/jsx-dev-runtime', ['jsxDEV']);

import App from './App';

registerRootComponent(App);
