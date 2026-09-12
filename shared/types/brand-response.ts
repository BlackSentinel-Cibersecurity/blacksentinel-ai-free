// BLACKSENTINEL AI - Brand-Aware Response Types
// Ensures all API responses include brand context

import { BRAND } from '@blacksentinel/shared/constants/brand';

// ============================================================================
// BASE RESPONSE TYPES
// ============================================================================

export interface BrandContext {
  logo: string;
  colors: typeof BRAND.colors;
  fonts: typeof BRAND.fonts;
}

export interface BrandResponse<T = unknown> {
  brand: BrandContext;
  data: T;
  timestamp: string;
}

export interface SeverityResponse<T = unknown> {
  brand: BrandContext;
  severity: {
    level: string;
    color: string;
    badge: {
      color: string;
      background: string;
      border: string;
    };
  };
  data: T;
  timestamp: string;
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

export function createBrandResponse<T>(data: T): BrandResponse<T> {
  return {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
      fonts: BRAND.fonts,
    },
    data,
    timestamp: new Date().toISOString(),
  };
}

export function createSeverityResponse<T>(severity: string, data: T): SeverityResponse<T> {
  const color = getSeverityColor(severity);
  return {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
      fonts: BRAND.fonts,
    },
    severity: {
      level: severity,
      color,
      badge: {
        color,
        background: `${color}20`,
        border: `${color}40`,
      },
    },
    data,
    timestamp: new Date().toISOString(),
  };
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: BRAND.colors.critical,
    high: BRAND.colors.orange.primary,
    medium: BRAND.colors.warning,
    low: BRAND.colors.info,
    informational: BRAND.colors.gray.light,
  };
  return colors[severity] || BRAND.colors.gray.medium;
}
