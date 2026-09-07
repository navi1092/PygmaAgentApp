export const DEFAULT_PRIMARY_COLOR = '#2874B2';

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
