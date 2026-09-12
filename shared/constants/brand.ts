// BLACKSENTINEL AI - Brand Constants
// Official Visual Identity System

export const BRAND = {
  // ============================================================================
  // LOGO
  // ============================================================================

  logo: {
    primary: '/images/logo.png',
    favicon: '/images/favicon.svg',
    icon: '/images/icon.png',
    wordmark: '/images/wordmark.png',
  },

  // ============================================================================
  // COLOR PALETTE
  // ============================================================================

  colors: {
    // Primary Backgrounds
    black: {
      deep: '#0B0B0B',      // Negro profundo - Primary background
      secondary: '#141414',  // Negro secundario - Card backgrounds
    },

    // Grays
    gray: {
      dark: '#232323',      // Gris oscuro - Borders, dividers
      medium: '#3C3C3C',    // Gris medio - Secondary text
      light: '#D9D9D9',     // Gris claro - Muted text
    },

    // Neutrals
    white: '#FFFFFF',       // Blanco - Primary text

    // Accent Colors
    orange: {
      primary: '#FF6B00',   // Naranja principal - Primary accent
      bright: '#FF8C1A',    // Naranja brillante - Hover states
      dark: '#CC5500',      // Naranja oscuro - Active states
      light: '#FF9933',     // Naranja claro - Light accents
    },

    // Status Colors
    critical: '#EF4444',    // Rojo critico - Critical alerts
    success: '#22C55E',     // Verde - Success states
    info: '#3B82F6',        // Azul - Informational
    warning: '#FACC15',     // Amarillo - Warning states

    // Semantic Aliases
    background: '#0B0B0B',
    surface: '#141414',
    surfaceHover: '#1A1A1A',
    border: '#232323',
    textPrimary: '#FFFFFF',
    textSecondary: '#D9D9D9',
    textMuted: '#3C3C3C',
    accent: '#FF6B00',
    accentHover: '#FF8C1A',
    error: '#EF4444',
    success2: '#22C55E',
    info2: '#3B82F6',
    warning2: '#FACC15',
  },

  // ============================================================================
  // TYPOGRAPHY
  // ============================================================================

  fonts: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    display: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },

  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // ============================================================================
  // SPACING
  // ============================================================================

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // ============================================================================
  // BORDER RADIUS
  // ============================================================================

  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },

  // ============================================================================
  // SHADOWS
  // ============================================================================

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(255, 107, 0, 0.3)',
    glowStrong: '0 0 40px rgba(255, 107, 0, 0.5)',
  },

  // ============================================================================
  // ANIMATIONS
  // ============================================================================

  animations: {
    fadeIn: 'fadeIn 0.3s ease-in-out',
    slideUp: 'slideUp 0.3s ease-out',
    slideDown: 'slideDown 0.3s ease-out',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    glow: 'glow 2s ease-in-out infinite alternate',
  },

  // ============================================================================
  // Z-INDEX
  // ============================================================================

  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
  },
} as const;

// ============================================================================
// CSS CUSTOM PROPERTIES (for use in CSS/SCSS)
// ============================================================================

export const CSS_CUSTOM_PROPERTIES = `
  :root {
    /* Colors */
    --bs-black-deep: ${BRAND.colors.black.deep};
    --bs-black-secondary: ${BRAND.colors.black.secondary};
    --bs-gray-dark: ${BRAND.colors.gray.dark};
    --bs-gray-medium: ${BRAND.colors.gray.medium};
    --bs-gray-light: ${BRAND.colors.gray.light};
    --bs-white: ${BRAND.colors.white};
    --bs-orange: ${BRAND.colors.orange.primary};
    --bs-orange-bright: ${BRAND.colors.orange.bright};
    --bs-orange-dark: ${BRAND.colors.orange.dark};
    --bs-orange-light: ${BRAND.colors.orange.light};
    --bs-critical: ${BRAND.colors.critical};
    --bs-success: ${BRAND.colors.success};
    --bs-info: ${BRAND.colors.info};
    --bs-warning: ${BRAND.colors.warning};

    /* Semantic */
    --bs-bg: var(--bs-black-deep);
    --bs-surface: var(--bs-black-secondary);
    --bs-border: var(--bs-gray-dark);
    --bs-text: var(--bs-white);
    --bs-text-secondary: var(--bs-gray-light);
    --bs-text-muted: var(--bs-gray-medium);
    --bs-accent: var(--bs-orange);
    --bs-accent-hover: var(--bs-orange-bright);

    /* Typography */
    --bs-font-primary: ${BRAND.fonts.primary};
    --bs-font-mono: ${BRAND.fonts.mono};

    /* Shadows */
    --bs-shadow-sm: ${BRAND.shadows.sm};
    --bs-shadow-md: ${BRAND.shadows.md};
    --bs-shadow-lg: ${BRAND.shadows.lg};
    --bs-shadow-glow: ${BRAND.shadows.glow};
  }
`;

export default BRAND;
