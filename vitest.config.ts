// BLACKSENTINEL AI - Vitest configuration
//
// Without this file, vitest has no idea what `@blacksentinel/shared/*` (or any
// of the other `@blacksentinel/*` path aliases declared in tsconfig.json) means
// — tsconfig `paths` are a TypeScript-compiler concept, `tsx` happens to honor
// them at dev/run time, but vitest does not unless told to. That gap is why
// every existing "test" in this repo only ever asserted against inline object
// literals: importing real route/engine code into a test would have failed to
// resolve. Mirror the tsconfig paths here so tests can import actual source.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // The external exFAT drive this repo happens to live on shadows every
    // real file with an AppleDouble `._<name>` sidecar the instant it's
    // created (see the memory notes on git-gc breaking for the same reason).
    // Vitest's glob would otherwise pick those up as bogus zero-byte test
    // files and fail the run. This exclude is filesystem-quirk mitigation,
    // not app config — drop it once the repo lives on APFS/ext4.
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
  resolve: {
    alias: {
      '@blacksentinel/shared': r('shared'),
    },
  },
});
