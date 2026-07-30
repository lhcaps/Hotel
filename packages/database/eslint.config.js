import baseConfig from '@room/eslint-config/base';

export default [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
      },
    },
  },
];
