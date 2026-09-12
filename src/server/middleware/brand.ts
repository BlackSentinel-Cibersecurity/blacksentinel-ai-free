// BLACKSENTINEL AI - Brand Middleware
// Ensures brand colors are included in all API responses

import { Request, Response, NextFunction } from 'express';
import { BRAND } from '@blacksentinel/shared/constants/brand';

// ============================================================================
// BRAND CONTEXT MIDDLEWARE
// Adds brand context to every response
// ============================================================================

export function brandContext(req: Request, res: Response, next: NextFunction) {
  // Add brand headers
  res.setHeader('X-Brand-Primary', BRAND.colors.orange.primary);
  res.setHeader('X-Brand-Background', BRAND.colors.black.deep);
  res.setHeader('X-Brand-Accent', BRAND.colors.orange.primary);

  // Add brand info to response locals
  (res as any).brand = {
    colors: BRAND.colors,
    logo: BRAND.logo,
    fonts: BRAND.fonts,
  };

  next();
}

// ============================================================================
// SEVERITY COLOR HELPER
// Returns brand-consistent colors for severity levels
// ============================================================================

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: BRAND.colors.critical,
    high: BRAND.colors.orange.primary,
    medium: BRAND.colors.warning,
    low: BRAND.colors.info,
    informational: BRAND.colors.gray.light,
  };
  return colors[severity] || BRAND.colors.gray.medium;
}

export function getSeverityBadge(severity: string) {
  return {
    color: getSeverityColor(severity),
    background: `${getSeverityColor(severity)}20`,
    border: `${getSeverityColor(severity)}40`,
  };
}

// ============================================================================
// STATUS COLOR HELPER
// ============================================================================

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    operational: BRAND.colors.success,
    degraded: BRAND.colors.warning,
    down: BRAND.colors.critical,
    unknown: BRAND.colors.gray.medium,
    active: BRAND.colors.success,
    inactive: BRAND.colors.gray.medium,
    investigating: BRAND.colors.orange.primary,
    contained: BRAND.colors.info,
    eradicated: BRAND.colors.warning,
    recovered: BRAND.colors.success,
    closed: BRAND.colors.gray.medium,
  };
  return colors[status] || BRAND.colors.gray.medium;
}

// ============================================================================
// CONFIDENCE COLOR HELPER
// ============================================================================

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return BRAND.colors.success;
  if (confidence >= 0.7) return BRAND.colors.success;
  if (confidence >= 0.5) return BRAND.colors.warning;
  if (confidence >= 0.3) return BRAND.colors.critical;
  return BRAND.colors.critical;
}

// ============================================================================
// BRAND RESPONSE BUILDER
// Builds complete brand-aware response objects
// ============================================================================

export function buildBrandResponse(data: unknown) {
  return {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    data,
    timestamp: new Date().toISOString(),
  };
}

export function buildSeverityResponse(severity: string, data: unknown) {
  return {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    severity: {
      level: severity,
      color: getSeverityColor(severity),
      badge: getSeverityBadge(severity),
    },
    data,
    timestamp: new Date().toISOString(),
  };
}

export default brandContext;
