export const darkColors = {
    background: '#000000',
    surface: '#131722',
    surfaceLight: '#1c2030',
    text: '#FFFFFF',
    textSecondary: '#D1D4DC',
    textMuted: '#848E9C',
    textSubtle: '#64748B',
    primary: '#2962FF',
    primaryLight: '#2962FF',
    accent: '#9C27B0',
    accentLight: '#BA68C8',
    success: '#089981',
    successLight: '#26a69a',
    successBackground: 'rgba(8, 153, 129, 0.12)',
    danger: '#F23645',
    dangerLight: '#ef5350',
    dangerBackground: 'rgba(242, 54, 69, 0.12)',
    warning: '#FF9800',
    border: 'rgba(255,255,255,0.08)',
    tabBar: '#131722',
    tabBarBorder: '#1c2030',
    tabBarInactive: '#848E9C',
    // Glass effects
    glassBg: 'rgba(255,255,255,0.02)',
    glassBorder: 'rgba(255,255,255,0.05)',
    glassModal: 'rgba(10, 14, 23, 0.35)',
    glassCard: 'rgba(255, 255, 255, 0.02)',
    glassCardBorder: 'rgba(255, 255, 255, 0.08)',
    glassInputBg: 'rgba(30,34,45,0.8)',
    glassInputBorder: 'rgba(255,255,255,0.1)',
    glassPillBg: 'rgba(255,255,255,0.03)',
    glassPillBorder: 'rgba(255,255,255,0.06)',
    glassButtonBg: 'rgba(255,255,255,0.06)',
    // Glow orbs
    glowBlue: 'rgba(59, 130, 246, 0.3)',
    glowPurple: 'rgba(168, 85, 247, 0.3)',
    glowGreen: 'rgba(8, 153, 129, 0.25)',
    // Blur
    blurIntensity: 80,
    blurTint: 'dark' as const,
    // Account switcher
    switcherBg: '#1E222D',
    switcherBorder: 'rgba(255,255,255,0.05)',
    // Misc
    logo1: '#E53935', logo2: '#039BE5', logo3: '#43A047', logo4: '#FDD835', logo5: '#8E24AA', logo6: '#F4511E', logo7: '#757575',
};

export const lightColors = {
    background: '#FFFFFF', // Pure white background in light mode
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceLight: 'rgba(255, 255, 255, 0.85)',
    text: '#0F172A',
    textSecondary: '#1E293B',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    accent: '#7C3AED',
    accentLight: '#8B5CF6',
    success: '#059669',
    successLight: '#10B981',
    successBackground: 'rgba(5, 150, 105, 0.12)',
    danger: '#DC2626',
    dangerLight: '#EF4444',
    dangerBackground: 'rgba(220, 38, 38, 0.1)',
    warning: '#D97706',
    border: 'rgba(15, 23, 42, 0.12)',
    tabBar: 'rgba(255, 255, 255, 0.95)',
    tabBarBorder: 'rgba(15, 23, 42, 0.08)',
    tabBarInactive: '#94A3B8',
    // Glass effects — Frosted/matte Telegram style
    glassBg: 'rgba(255, 255, 255, 0.9)',
    glassBorder: 'rgba(15, 23, 42, 0.12)',
    glassModal: '#FFFFFF',
    glassCard: '#FFFFFF',
    glassCardBorder: 'rgba(15, 23, 42, 0.12)',
    glassInputBg: '#FFFFFF',
    glassInputBorder: 'rgba(15, 23, 42, 0.15)',
    glassPillBg: 'rgba(255, 255, 255, 0.95)',
    glassPillBorder: 'rgba(15, 23, 42, 0.12)',
    glassButtonBg: 'rgba(255, 255, 255, 0.95)',
    // Glow orbs — softer pastel for light mode
    glowBlue: 'rgba(191, 219, 254, 0.8)',
    glowPurple: 'rgba(233, 213, 255, 0.8)',
    glowGreen: 'rgba(167, 243, 208, 0.8)',
    // Blur
    blurIntensity: 50,
    blurTint: 'light' as const,
    // Account switcher
    switcherBg: 'rgba(255,255,255,0.8)',
    switcherBorder: 'rgba(255,255,255,1)',
    // Misc
    logo1: '#E53935', logo2: '#039BE5', logo3: '#43A047', logo4: '#FDD835', logo5: '#8E24AA', logo6: '#F4511E', logo7: '#757575',
};

// Fallback for files that still import colors directly (until they are all migrated)
export const colors = darkColors;
