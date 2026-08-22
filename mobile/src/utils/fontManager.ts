import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Platform } from 'react-native';

export interface AppFont {
  id: string;
  name: string;
  isFarsi: boolean;
}

// 60 Premium, Highly-Curated Universal Mobile App Fonts
export const AVAILABLE_FONTS: AppFont[] = [
  // Top Modern Sans & Geometric UI Fonts
  { id: 'Righteous', name: 'Righteous (Art Deco Urban)', isFarsi: false },
  { id: 'Montserrat', name: 'Montserrat (Geometric Modern - Default)', isFarsi: false },
  { id: 'Inter', name: 'Inter (Sleek Tech UI)', isFarsi: false },
  { id: 'Roboto', name: 'Roboto (Standard Android)', isFarsi: false },
  { id: 'Poppins', name: 'Poppins (Geometric Clean)', isFarsi: false },
  { id: 'SpaceGrotesk', name: 'Space Grotesk (Tech Modern)', isFarsi: false },
  { id: 'Outfit', name: 'Outfit (Premium Minimal)', isFarsi: false },
  { id: 'Lato', name: 'Lato (Humanist Sans)', isFarsi: false },
  { id: 'OpenSans', name: 'Open Sans (Neutral Clean)', isFarsi: false },
  { id: 'Oswald', name: 'Oswald (Condensed Impact)', isFarsi: false },
  { id: 'Raleway', name: 'Raleway (Elegant Thin)', isFarsi: false },
  { id: 'Nunito', name: 'Nunito (Soft Rounded)', isFarsi: false },
  { id: 'Sora', name: 'Sora (Futuristic UI)', isFarsi: false },
  { id: 'PlusJakartaSans', name: 'Plus Jakarta Sans (Modern Executive)', isFarsi: false },
  { id: 'Urbanist', name: 'Urbanist (Clean Trendy)', isFarsi: false },
  { id: 'Manrope', name: 'Manrope (Modern Humanist)', isFarsi: false },
  { id: 'DmSans', name: 'DM Sans (Geometric Neutral)', isFarsi: false },
  { id: 'Syne', name: 'Syne (Avant-Garde Display)', isFarsi: false },
  { id: 'Lexend', name: 'Lexend (High Readability)', isFarsi: false },
  { id: 'WorkSans', name: 'Work Sans (Optimized UI)', isFarsi: false },
  { id: 'Rubik', name: 'Rubik (Rounded Geometric)', isFarsi: false },
  { id: 'RedHatDisplay', name: 'Red Hat Display (Corporate Modern)', isFarsi: false },
  { id: 'Epilogue', name: 'Epilogue (Contemporary Sans)', isFarsi: false },
  { id: 'Quicksand', name: 'Quicksand (Friendly Rounded)', isFarsi: false },
  { id: 'Comfortaa', name: 'Comfortaa (Rounded Tech)', isFarsi: false },
  { id: 'Acme', name: 'Acme (Compact Modern)', isFarsi: false },
  { id: 'Kanit', name: 'Kanit (Thai Futuristic)', isFarsi: false },
  { id: 'Rajdhani', name: 'Rajdhani (Square Sci-Fi)', isFarsi: false },
  { id: 'ChakraPetch', name: 'Chakra Petch (Cyberpunk Tech)', isFarsi: false },

  // Premium Serif & Classic Fonts
  { id: 'PlayfairDisplay', name: 'Playfair Display (Editorial Serif)', isFarsi: false },
  { id: 'AbrilFatface', name: 'Abril Fatface (Heavy Display Serif)', isFarsi: false },
  { id: 'Cinzel', name: 'Cinzel (Roman Classical)', isFarsi: false },
  { id: 'CinzelDecorative', name: 'Cinzel Decorative (Luxury Serif)', isFarsi: false },

  // Gaming, Retro & Display Icons
  { id: 'PressStart2P', name: 'Press Start 2P (8-Bit Pixel Gaming)', isFarsi: false },
  { id: 'Silkscreen', name: 'Silkscreen (Retro Arcade Pixel)', isFarsi: false },
  { id: 'Orbitron', name: 'Orbitron (Futuristic Sci-Fi)', isFarsi: false },
  { id: 'Monoton', name: 'Monoton (Disco Line Retro)', isFarsi: false },
  { id: 'BebasNeue', name: 'Bebas Neue (Headline Caps)', isFarsi: false },
  { id: 'Anton', name: 'Anton (Ultra Heavy Impact)', isFarsi: false },
  { id: 'RussoOne', name: 'Russo One (Bold Sport Metal)', isFarsi: false },
  { id: 'TitanOne', name: 'Titan One (Bubble Display)', isFarsi: false },
  { id: 'AlfaSlabOne', name: 'Alfa Slab One (Heavy Block)', isFarsi: false },
  { id: 'Shrikhand', name: 'Shrikhand (Bold Vintage Retro)', isFarsi: false },
  { id: 'LuckiestGuy', name: 'Luckiest Guy (Bold Comic Cartoon)', isFarsi: false },
  { id: 'Bangers', name: 'Bangers (Comic Action)', isFarsi: false },
  { id: 'BalsamiqSans', name: 'Balsamiq Sans (Comic Sketch)', isFarsi: false },
  { id: 'Creepster', name: 'Creepster (Horror Style)', isFarsi: false },
  { id: 'ConcertOne', name: 'Concert One (3D Rounded)', isFarsi: false },

  // Cursive, Script & Handwritten Fonts
  { id: 'Pacifico', name: 'Pacifico (Brush Script)', isFarsi: false },
  { id: 'DancingScript', name: 'Dancing Script (Elegant Cursive)', isFarsi: false },
  { id: 'GreatVibes', name: 'Great Vibes (Luxury Calligraphy)', isFarsi: false },
  { id: 'Caveat', name: 'Caveat (Casual Handwriting)', isFarsi: false },
  { id: 'Kalam', name: 'Kalam (Handwritten Marker)', isFarsi: false },
  { id: 'Courgette', name: 'Courgette (Italic Script)', isFarsi: false },
  { id: 'Sacramento', name: 'Sacramento (Slim Cursive)', isFarsi: false },
  { id: 'ShadowsIntoLight', name: 'Shadows Into Light (Neat Script)', isFarsi: false },
  { id: 'AmaticSC', name: 'Amatic SC (Handdrawn Tall)', isFarsi: false },

  // Monospace / Code Fonts
  { id: 'FiraCode', name: 'Fira Code (Developer Ligatures)', isFarsi: false },
  { id: 'SpaceMono', name: 'Space Mono (Retro Developer Mono)', isFarsi: false },
];

const LOCAL_FONT_REQUIRES: { [key: string]: any } = {
  Righteous: require('../../assets/fonts/Righteous.ttf'),
  Montserrat: require('../../assets/fonts/Montserrat-Regular.ttf'),
  'Montserrat-Regular': require('../../assets/fonts/Montserrat-Regular.ttf'),
  'Montserrat-Medium': require('../../assets/fonts/Montserrat-Medium.ttf'),
  'Montserrat-SemiBold': require('../../assets/fonts/Montserrat-SemiBold.ttf'),
  'Montserrat-Bold': require('../../assets/fonts/Montserrat-Bold.ttf'),
  Inter: require('../../assets/fonts/Inter.ttf'),
  Roboto: require('../../assets/fonts/Roboto.ttf'),
  Poppins: require('../../assets/fonts/Poppins.ttf'),
  SpaceGrotesk: require('../../assets/fonts/SpaceGrotesk.ttf'),
  Outfit: require('../../assets/fonts/Outfit.ttf'),
  Lato: require('../../assets/fonts/Lato.ttf'),
  OpenSans: require('../../assets/fonts/OpenSans.ttf'),
  Oswald: require('../../assets/fonts/Oswald.ttf'),
  Raleway: require('../../assets/fonts/Raleway.ttf'),
  Nunito: require('../../assets/fonts/Nunito.ttf'),
  PlayfairDisplay: require('../../assets/fonts/PlayfairDisplay.ttf'),
  AbrilFatface: require('../../assets/fonts/AbrilFatface.ttf'),
  Acme: require('../../assets/fonts/Acme.ttf'),
  AmaticSC: require('../../assets/fonts/AmaticSC.ttf'),
  Anton: require('../../assets/fonts/Anton.ttf'),
  BalsamiqSans: require('../../assets/fonts/BalsamiqSans.ttf'),
  Bangers: require('../../assets/fonts/Bangers.ttf'),
  BebasNeue: require('../../assets/fonts/BebasNeue.ttf'),
  Caveat: require('../../assets/fonts/Caveat.ttf'),
  Cinzel: require('../../assets/fonts/Cinzel.ttf'),
  CinzelDecorative: require('../../assets/fonts/CinzelDecorative.ttf'),
  Comfortaa: require('../../assets/fonts/Comfortaa.ttf'),
  ConcertOne: require('../../assets/fonts/ConcertOne.ttf'),
  Courgette: require('../../assets/fonts/Courgette.ttf'),
  Creepster: require('../../assets/fonts/Creepster.ttf'),
  DancingScript: require('../../assets/fonts/DancingScript.ttf'),
  FiraCode: require('../../assets/fonts/FiraCode.ttf'),
  GreatVibes: require('../../assets/fonts/GreatVibes.ttf'),
  Kalam: require('../../assets/fonts/Kalam.ttf'),
  Kanit: require('../../assets/fonts/Kanit.ttf'),
  Lobster: require('../../assets/fonts/Lobster.ttf'),
  LuckiestGuy: require('../../assets/fonts/LuckiestGuy.ttf'),
  Monoton: require('../../assets/fonts/Monoton.ttf'),
  Orbitron: require('../../assets/fonts/Orbitron.ttf'),
  Pacifico: require('../../assets/fonts/Pacifico.ttf'),
  PressStart2P: require('../../assets/fonts/PressStart2P.ttf'),
  Quicksand: require('../../assets/fonts/Quicksand.ttf'),
  ShadowsIntoLight: require('../../assets/fonts/ShadowsIntoLight.ttf'),
  Sora: require('../../assets/fonts/Sora.ttf'),
  PlusJakartaSans: require('../../assets/fonts/PlusJakartaSans.ttf'),
  Urbanist: require('../../assets/fonts/Urbanist.ttf'),
  Manrope: require('../../assets/fonts/Manrope.ttf'),
  DmSans: require('../../assets/fonts/DmSans.ttf'),
  Syne: require('../../assets/fonts/Syne.ttf'),
  Lexend: require('../../assets/fonts/Lexend.ttf'),
  WorkSans: require('../../assets/fonts/WorkSans.ttf'),
  RedHatDisplay: require('../../assets/fonts/RedHatDisplay.ttf'),
  Epilogue: require('../../assets/fonts/Epilogue.ttf'),
  SpaceMono: require('../../assets/fonts/SpaceMono.ttf'),
  ChakraPetch: require('../../assets/fonts/ChakraPetch.ttf'),
  Rajdhani: require('../../assets/fonts/Rajdhani.ttf'),
  TitanOne: require('../../assets/fonts/TitanOne.ttf'),
  AlfaSlabOne: require('../../assets/fonts/AlfaSlabOne.ttf'),
  Shrikhand: require('../../assets/fonts/Shrikhand.ttf'),
  RussoOne: require('../../assets/fonts/RussoOne.ttf'),
  Fredoka: require('../../assets/fonts/Fredoka.ttf'),
  Sacramento: require('../../assets/fonts/Sacramento.ttf'),
  Silkscreen: require('../../assets/fonts/Silkscreen.ttf'),
};

export const setGlobalFont = (fontName: string) => {
  console.log(`[FontManager] Applying global font: ${fontName}`);
  (global as any).activeAppFont = fontName;
  
  if (typeof document !== 'undefined') {
    const styleId = 'dynamic-app-font';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      body, html, #root, * {
        font-family: '${fontName}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      }
    `;
  }

  if ((global as any).triggerFontChange) {
    (global as any).triggerFontChange();
  }
};

// Loads a pre-bundled font locally
export const loadAndApplyFont = async (fontId: string): Promise<boolean> => {
  try {
    const fontRequire = LOCAL_FONT_REQUIRES[fontId];
    if (!fontRequire) {
      console.warn(`[FontManager] Font source not pre-bundled: ${fontId}`);
      return false;
    }

    console.log(`[FontManager] Loading pre-bundled font: ${fontId}`);
    
    if (fontId === 'Montserrat') {
      await Font.loadAsync({
        Montserrat: require('../../assets/fonts/Montserrat-Regular.ttf'),
        'Montserrat-Regular': require('../../assets/fonts/Montserrat-Regular.ttf'),
        'Montserrat-Medium': require('../../assets/fonts/Montserrat-Medium.ttf'),
        'Montserrat-SemiBold': require('../../assets/fonts/Montserrat-SemiBold.ttf'),
        'Montserrat-Bold': require('../../assets/fonts/Montserrat-Bold.ttf'),
      });
    } else {
      await Font.loadAsync({
        [fontId]: fontRequire,
      });
    }

    console.log(`[FontManager] Font loaded successfully. Injecting...`);
    setGlobalFont(fontId);
    
    await AsyncStorage.setItem('selectedAppFont', fontId);
    return true;
  } catch (err: any) {
    console.error(`[FontManager] Failed to load/apply local font ${fontId}:`, err.message || err);
    return false;
  }
};

// Run at application startup to restore user's preferred font choice
export const initAppFont = async () => {
  try {
    const savedFont = await AsyncStorage.getItem('selectedAppFont');
    if (savedFont && LOCAL_FONT_REQUIRES[savedFont]) {
      await loadAndApplyFont(savedFont);
    } else {
      const defaultFont = Platform.OS !== 'web' ? 'Righteous' : 'Montserrat';
      await loadAndApplyFont(defaultFont);
    }
  } catch (err: any) {
    console.error('[FontManager] Error initializing app font:', err.message || err);
  }
};
