import baseConfig from '@room/eslint-config/base';
import playwright from '@playwright/test';

const playwrightGlobals = Object.fromEntries(
  Object.keys(playwright).map((key) => [key, 'readonly']),
);

export default [
  ...baseConfig,
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts'],
          defaultConfig: './tsconfig.json',
        },
      },
      globals: {
        ...playwrightGlobals,
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        window: 'readonly',
      },
    },
  },
];
