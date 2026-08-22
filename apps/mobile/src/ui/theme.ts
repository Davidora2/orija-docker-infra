import { Platform } from 'react-native';

export const colors = {
  ink: '#14241F',
  inkSoft: '#24362F',
  inkBorder: '#203B31',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  lineSoft: '#E8EBE7',
  muted: '#6C7771',
  mutedOnDark: 'rgba(255,255,255,0.55)',
  labelOnDark: 'rgba(255,255,255,0.60)',
  cream: '#F4F5F0',
  creamText: '#FFFFFF',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  sageSurface: '#EEF3EA',
  acid: '#D6F57A',
  acidInk: '#2F431E',
  acidGlow: 'rgba(214,245,122,0.15)',
  acidGlowSoft: 'rgba(214,245,122,0.08)',
  outlineOnDark: 'rgba(255,255,255,0.15)',
  amber: '#F2C66D',
  amberSoft: '#FFF3E8',
  danger: '#C9634F',
  dangerSoft: '#FDF4F1',
  dangerBorder: '#E8C7BD',
  overBg: '#FDF4F1',
  overText: '#B75542',
};

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

export const radii = {
  card: 18,
  hero: 24,
  button: 12,
  chip: 999,
};

export const spacing = {
  screen: 16,
  card: 16,
  stack: 12,
};
