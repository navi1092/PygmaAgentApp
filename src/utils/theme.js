export const DEFAULT_PRIMARY_COLOR = '#847CFB';

// Local presentation defaults. API BackColor still takes precedence below.
export const UI_COLORS = {
  text: '#000000',
  secondaryText: '#808080',
  surface: '#FFFFFF',
  listBackground: '#F7F8FC',
  inputBackground: '#FFFFFF',
  border: '#D4D4D4',
  search: '#B786E8',
  success: '#006400',
  error: '#B00020',
};

export const UI_FONT = {
  caption: 12,
  body: 14,
  search: 14,
  action: 16,
  heading: 18,
  title: 20,
};

// The Android API model stores BackColor as a signed ARGB integer. React
// Native uses #RRGGBB, so retain the RGB bytes exactly as Android Color does.
export const androidColorToHex = (value, fallback = DEFAULT_PRIMARY_COLOR) => {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return fallback;
  const unsigned = numeric < 0 ? numeric + 0x100000000 : numeric;
  return `#${(unsigned % 0x1000000).toString(16).padStart(6, '0')}`;
};

// Matches MyApp.java: only User.BackColor becomes the global primary color.
export const getPrimaryColor = (user) => androidColorToHex(
  user?.BackColor ?? user?.backColor,
  DEFAULT_PRIMARY_COLOR
);
