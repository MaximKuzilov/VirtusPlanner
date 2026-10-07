import { useApp } from './AppContext';

export const lightColors = {
  background: '#F2F6F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E7EFF1',
  card: '#FFFFFF',
  cardBorder: '#E0EAED',
  border: '#D8E5E9',
  text: '#172F3C',
  textSecondary: '#294554',
  textMuted: '#58727F',
  textPlaceholder: '#647C87',
  accent: '#087F8C',
  accentText: '#087F8C',
  accentSoft: '#E0F3F3',
  tabBar: '#193443',
  navText: '#D6E3EB',
  navActive: '#61D8EC',
  navActiveBg: '#244B60',
  navBorder: '#294959',
  modalOverlay: 'rgba(12,31,42,0.55)',
  modalBg: '#FFFFFF',
  inputBg: '#EAF1F3',
  switchTrackOff: '#CDDDE2',
  progressBg: '#DFEAED',
  divider: '#E8EFF1',
  insightIconBg: '#E0F3F3',
};

export const darkColors: typeof lightColors = {
  background: '#101E29',
  surface: '#1A2D3B',
  surfaceAlt: '#263E4D',
  card: '#1A2D3B',
  cardBorder: '#2B4352',
  border: '#355161',
  text: '#F0F7FA',
  textSecondary: '#D8E8EF',
  textMuted: '#ACC4D0',
  textPlaceholder: '#9CB5C2',
  accent: '#148997',
  accentText: '#6AD5DE',
  accentSoft: '#203F4A',
  tabBar: '#193443',
  navText: '#D6E3EB',
  navActive: '#61D8EC',
  navActiveBg: '#244B60',
  navBorder: '#34515F',
  modalOverlay: 'rgba(0,0,0,0.7)',
  modalBg: '#1A2D3B',
  inputBg: '#263E4D',
  switchTrackOff: '#48616F',
  progressBg: '#304957',
  divider: '#2B4352',
  insightIconBg: '#263E4D',
};

export type ThemeColors = typeof lightColors;

export function useTheme(): { dark: boolean; colors: ThemeColors } {
  const { settings } = useApp();
  return {
    dark: settings.darkMode,
    colors: settings.darkMode ? darkColors : lightColors,
  };
}
