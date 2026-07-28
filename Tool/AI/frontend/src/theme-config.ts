/**
 * Design System Configuration
 * 
 * Theme System:
 * - Slate (default): Soft dark theme, not pure black
 * - Mist: Soft light theme, not pure white
 */

export type Theme = 'slate' | 'mist';

export interface ThemeConfig {
  id: Theme;
  label: string;
  description: string;
  colors: {
    // Backgrounds
    background: string;
    surface: string;
    surfaceAlt: string;
    surfaceElevated: string;
    
    // Borders
    border: string;
    borderStrong: string;
    
    // Primary & Accents
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primarySoft: string;
    primaryBorder: string;
    
    // Semantic
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    error: string;
    errorSoft: string;
    info: string;
    infoSoft: string;
    
    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    link: string;
    
    // Layout
    sidebar: string;
    header: string;
    
    // Interactive
    selection: string;
    hover: string;
    focusRing: string;
    disabled: string;
    
    //semantic - legacy aliases
    red: string;
    redSoft: string;
    redDeep: string;
    green: string;
    greenSoft: string;
    greenDeep: string;
    blue: string;
    blueSoft: string;
    blueDeep: string;
    violet: string;
    violetSoft: string;
    violetDeep: string;
    amber: string;
    amberSoft: string;
    amberDeep: string;
    yellow: string;
    yellowSoft: string;
    yellowDeep: string;
  };
  shadows: {
    none: string;
    small: string;
    medium: string;
    large: string;
  };
  typography: {
    display: string;
    heading: string;
    title: string;
    body: string;
    small: string;
    caption: string;
  };
  spacing: {
    4: string;
    8: string;
    12: string;
    16: string;
    20: string;
    24: string;
    32: string;
    40: string;
    48: string;
  };
  radius: {
    small: string;
    medium: string;
    large: string;
    pill: string;
  };
}

export const slateTheme: ThemeConfig = {
  id: 'slate',
  label: 'Slate',
  description: 'Soft dark theme',
  colors: {
    background: '#0F172A',
    surface: '#182235',
    surfaceAlt: '#1E293B',
    surfaceElevated: '#263449',
    border: '#334155',
    borderStrong: '#475569',
    primary: '#8B7CFF',
    primaryHover: '#9B8EFF',
    primaryActive: '#7667F5',
    primarySoft: 'rgba(139, 124, 255, 0.14)',
    primaryBorder: 'rgba(139, 124, 255, 0.30)',
    success: '#4ADE80',
    successSoft: 'rgba(74, 222, 128, 0.14)',
    warning: '#FBBF24',
    warningSoft: 'rgba(251, 191, 36, 0.14)',
    error: '#F87171',
    errorSoft: 'rgba(248, 113, 113, 0.14)',
    info: '#60A5FA',
    infoSoft: 'rgba(96, 165, 250, 0.14)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    link: '#8B7CFF',
    sidebar: '#111827',
    header: 'rgba(17, 24, 39, 0.96)',
    selection: 'rgba(139, 124, 255, 0.18)',
    hover: '#263449',
    focusRing: 'rgba(139, 124, 255, 0.40)',
    disabled: '#64748B',
    red: '#F87171',
    redSoft: 'rgba(248, 113, 113, 0.14)',
    redDeep: '#EF4444',
    green: '#4ADE80',
    greenSoft: 'rgba(74, 222, 128, 0.14)',
    greenDeep: '#22C55E',
    blue: '#60A5FA',
    blueSoft: 'rgba(96, 165, 250, 0.14)',
    blueDeep: '#3B82F6',
    violet: '#A78BFA',
    violetSoft: 'rgba(167, 139, 250, 0.14)',
    violetDeep: '#8B5CF6',
    amber: '#FBBF24',
    amberSoft: 'rgba(251, 191, 36, 0.14)',
    amberDeep: '#F59E0B',
    yellow: '#FBBF24',
    yellowSoft: 'rgba(251, 191, 36, 0.14)',
    yellowDeep: '#F59E0B',
  },
  shadows: {
    none: 'none',
    small: '0 2px 8px rgba(0, 0, 0, 0.20)',
    medium: '0 4px 16px rgba(0, 0, 0, 0.24)',
    large: '0 12px 32px rgba(0, 0, 0, 0.30)',
  },
  typography: {
    display: '28px',
    heading: '20px',
    title: '17px',
    body: '14px',
    small: '12px',
    caption: '11px',
  },
  spacing: {
    4: '4px',
    8: '8px',
    12: '12px',
    16: '16px',
    20: '20px',
    24: '24px',
    32: '32px',
    40: '40px',
    48: '48px',
  },
  radius: {
    small: '6px',
    medium: '10px',
    large: '14px',
    pill: '9999px',
  },
};

export const mistTheme: ThemeConfig = {
  id: 'mist',
  label: 'Mist',
  description: 'Soft light theme',
  colors: {
    background: '#F7F8FC',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    surfaceElevated: '#FFFFFF',
    border: '#E5E7EB',
    borderStrong: '#D7DCE5',
    primary: '#6D5DFB',
    primaryHover: '#5B4BE7',
    primaryActive: '#4F46E5',
    primarySoft: '#F1EFFF',
    primaryBorder: '#DDD8FF',
    success: '#16A34A',
    successSoft: '#F0FDF4',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    error: '#DC2626',
    errorSoft: '#FEF2F2',
    info: '#2563EB',
    infoSoft: '#EFF6FF',
    textPrimary: '#111827',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    link: '#6D5DFB',
    sidebar: '#FFFFFF',
    header: 'rgba(255, 255, 255, 0.96)',
    selection: 'rgba(109, 93, 251, 0.10)',
    hover: '#F1F5F9',
    focusRing: 'rgba(109, 93, 251, 0.30)',
    disabled: '#9CA3AF',
    red: '#DC2626',
    redSoft: '#FEF2F2',
    redDeep: '#B91C1C',
    green: '#16A34A',
    greenSoft: '#F0FDF4',
    greenDeep: '#15803D',
    blue: '#2563EB',
    blueSoft: '#EFF6FF',
    blueDeep: '#1D4ED8',
    violet: '#7C3AED',
    violetSoft: '#F5F3FF',
    violetDeep: '#6D28D9',
    amber: '#D97706',
    amberSoft: '#FFFBEB',
    amberDeep: '#B45309',
    yellow: '#D97706',
    yellowSoft: '#FFFBEB',
    yellowDeep: '#B45309',
  },
  shadows: {
    none: 'none',
    small: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
    medium: '0 4px 14px rgba(15, 23, 42, 0.08)',
    large: '0 8px 24px rgba(15, 23, 42, 0.10)',
  },
  typography: {
    display: '28px',
    heading: '20px',
    title: '17px',
    body: '14px',
    small: '12px',
    caption: '11px',
  },
  spacing: {
    4: '4px',
    8: '8px',
    12: '12px',
    16: '16px',
    20: '20px',
    24: '24px',
    32: '32px',
    40: '40px',
    48: '48px',
  },
  radius: {
    small: '6px',
    medium: '10px',
    large: '14px',
    pill: '9999px',
  },
};

export const themes: Record<Theme, ThemeConfig> = {
  slate: slateTheme,
  mist: mistTheme,
};

export const defaultTheme: Theme = 'slate';