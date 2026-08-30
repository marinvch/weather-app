import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

const FEATURES = [
  'forecast',
  'marine',
  'mountain',
  'agriculture',
  'location',
  'alerts',
  'pwa',
]

/**
 * The architecture, enforced rather than described: dependencies flow one way,
 * shared -> features -> app, and features never reach into each other.
 *
 * This uses the built-in no-restricted-imports on the "@/" alias rather than
 * import/no-restricted-paths, which needs a resolver plugin that currently
 * conflicts with this repo's typescript-eslint version. It works because every
 * cross-layer import in this codebase goes through the alias — a relative
 * "../../features/marine" would slip past, so keep using "@/".
 */
const boundaries = [
  {
    // Shared is the foundation. It knows nothing about what sits above it.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: ['@/features/*', '@/features/**'],
          message: 'src/shared must not import from a feature — that inverts the dependency and makes shared undeletable.',
        },
        {
          group: ['@/app/*', '@/app/**'],
          message: 'src/shared must not import from src/app.',
        },
      ]}],
    },
  },
  // Each feature is self-contained: it may not import any other feature, and
  // may not depend on the composition root.
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: FEATURES.filter((f) => f !== feature).flatMap((f) => [
            `@/features/${f}`,
            `@/features/${f}/*`,
            `@/features/${f}/**`,
          ]),
          message: 'Features must not import from each other — compose them in src/app instead.',
        },
        {
          group: ['@/app/*', '@/app/**'],
          message: 'A feature must not import from src/app — the dependency runs the other way.',
        },
      ]}],
    },
  })),
]

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  ...boundaries,
])
