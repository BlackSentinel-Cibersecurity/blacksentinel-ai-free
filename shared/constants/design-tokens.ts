// BLACKSENTINEL AI - Design System Tokens
// Complete UI component tokens matching the brand identity

import { BRAND } from './brand';

export const DESIGN_TOKENS = {
  // ============================================================================
  // BUTTONS
  // ============================================================================

  button: {
    primary: {
      background: BRAND.colors.orange.primary,
      backgroundHover: BRAND.colors.orange.bright,
      backgroundActive: BRAND.colors.orange.dark,
      text: BRAND.colors.white,
      borderRadius: BRAND.borderRadius.md,
      fontWeight: BRAND.fontWeights.semibold,
    },
    secondary: {
      background: 'transparent',
      backgroundHover: BRAND.colors.gray.dark,
      border: BRAND.colors.gray.medium,
      text: BRAND.colors.white,
      borderRadius: BRAND.borderRadius.md,
    },
    ghost: {
      background: 'transparent',
      backgroundHover: BRAND.colors.gray.dark,
      text: BRAND.colors.gray.light,
      borderRadius: BRAND.borderRadius.md,
    },
    danger: {
      background: BRAND.colors.critical,
      backgroundHover: '#DC2626',
      text: BRAND.colors.white,
      borderRadius: BRAND.borderRadius.md,
    },
    success: {
      background: BRAND.colors.success,
      backgroundHover: '#16A34A',
      text: BRAND.colors.white,
      borderRadius: BRAND.borderRadius.md,
    },
  },

  // ============================================================================
  // INPUTS
  // ============================================================================

  input: {
    background: BRAND.colors.black.secondary,
    border: BRAND.colors.gray.dark,
    borderFocus: BRAND.colors.orange.primary,
    text: BRAND.colors.white,
    placeholder: BRAND.colors.gray.medium,
    borderRadius: BRAND.borderRadius.md,
    height: {
      sm: '2rem',
      md: '2.5rem',
      lg: '3rem',
    },
  },

  // ============================================================================
  // CARDS
  // ============================================================================

  card: {
    background: BRAND.colors.black.secondary,
    border: BRAND.colors.gray.dark,
    borderRadius: BRAND.borderRadius.lg,
    shadow: BRAND.shadows.md,
    padding: BRAND.spacing.lg,
  },

  // ============================================================================
  // SEVERITY BADGES
  // ============================================================================

  severity: {
    critical: {
      background: 'rgba(239, 68, 68, 0.15)',
      text: BRAND.colors.critical,
      border: 'rgba(239, 68, 68, 0.3)',
    },
    high: {
      background: 'rgba(255, 107, 0, 0.15)',
      text: BRAND.colors.orange.primary,
      border: 'rgba(255, 107, 0, 0.3)',
    },
    medium: {
      background: 'rgba(250, 204, 21, 0.15)',
      text: BRAND.colors.warning,
      border: 'rgba(250, 204, 21, 0.3)',
    },
    low: {
      background: 'rgba(59, 130, 246, 0.15)',
      text: BRAND.colors.info,
      border: 'rgba(59, 130, 246, 0.3)',
    },
    info: {
      background: 'rgba(217, 217, 217, 0.1)',
      text: BRAND.colors.gray.light,
      border: 'rgba(217, 217, 217, 0.2)',
    },
  },

  // ============================================================================
  // STATUS INDICATORS
  // ============================================================================

  status: {
    operational: BRAND.colors.success,
    degraded: BRAND.colors.warning,
    down: BRAND.colors.critical,
    unknown: BRAND.colors.gray.medium,
  },

  // ============================================================================
  // CONFIDENCE INDICATORS
  // ============================================================================

  confidence: {
    veryHigh: { color: BRAND.colors.success, min: 0.9 },
    high: { color: BRAND.colors.success, min: 0.7 },
    medium: { color: BRAND.colors.warning, min: 0.5 },
    low: { color: BRAND.colors.critical, min: 0.3 },
    veryLow: { color: BRAND.colors.critical, min: 0 },
  },

  // ============================================================================
  // CHART COLORS
  // ============================================================================

  chart: {
    primary: [BRAND.colors.orange.primary, BRAND.colors.orange.bright, BRAND.colors.orange.light],
    status: [BRAND.colors.success, BRAND.colors.warning, BRAND.colors.critical, BRAND.colors.info],
    gradient: {
      orange: `linear-gradient(135deg, ${BRAND.colors.orange.primary}, ${BRAND.colors.orange.bright})`,
      dark: `linear-gradient(135deg, ${BRAND.colors.black.secondary}, ${BRAND.colors.gray.dark})`,
      alert: `linear-gradient(135deg, ${BRAND.colors.critical}, ${BRAND.colors.orange.primary})`,
    },
  },

  // ============================================================================
  // LAYOUT
  // ============================================================================

  layout: {
    sidebarWidth: '280px',
    headerHeight: '64px',
    contentMaxWidth: '1400px',
    sidebarCollapsed: '72px',
  },
};

export default DESIGN_TOKENS;
