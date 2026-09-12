// BLACKSENTINEL AI - Cryptographic Utilities
//
// This used to fall back to 'blacksentinel-default-key-change-in-production-32b!'
// and 'blacksentinel-jwt-secret' — literal strings baked into source, and now
// sitting in this repo's git history — whenever ENCRYPTION_KEY/JWT_SECRET
// weren't set in the environment. config.ts already requires both via Zod
// and refuses to boot without them, but that check only runs if config.ts
// happens to be imported first; this module never depended on it, so a
// script or entrypoint that imports cryptoUtils without going through
// config.ts got silent encryption/signing with a publicly-known key instead
// of an error. Now it refuses outright rather than falling back.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

function requireSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value || value.length < 32) {
    throw new Error(
      `${envVar} must be set to a string of at least 32 characters. Refusing to start with a weaker or missing value — there is no built-in fallback.`
    );
  }
  return value;
}

export class CryptoUtils {
  private encryptionKey: Buffer;

  constructor(key?: string) {
    const rawKey = key || requireSecret('ENCRYPTION_KEY');
    this.encryptionKey = crypto.scryptSync(rawKey, 'blacksentinel-salt', 32);
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encrypted,
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    // `payload.algorithm` is a plain `string`, so createDecipheriv's overloads
    // resolve to the generic Decipher type (no setAuthTag). This is always
    // GCM at runtime — ALGORITHM is hardcoded above and never varies.
    const decipher = crypto.createDecipheriv(payload.algorithm, this.encryptionKey, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  hmac(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  generateId(): string {
    return crypto.randomUUID();
  }

  generateToken(payload: Record<string, unknown>, expiresIn: string = '24h'): string {
    return jwt.sign(payload, requireSecret('JWT_SECRET'), { expiresIn } as jwt.SignOptions);
  }

  verifyToken(token: string): Record<string, unknown> {
    return jwt.verify(token, requireSecret('JWT_SECRET')) as Record<string, unknown>;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateApiKey(): string {
    return `bs_${crypto.randomBytes(32).toString('hex')}`;
  }

  generateSecret(): string {
    return crypto.randomBytes(48).toString('base64');
  }
}

export interface EncryptedPayload {
  iv: string;
  encrypted: string;
  tag: string;
  algorithm: string;
}

export const cryptoUtils = new CryptoUtils();
export default cryptoUtils;
