import baseConfig from '@room/eslint-config/base';
import globals from 'globals';

const nodeGlobals = {
  ...globals.node,
  ...globals.nodeBuiltin,
};

const vitestGlobals = {
  ...globals.vitest,
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
  vitest: 'readonly',
  suite: 'readonly',
};

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'test/**/*.mts'],
    ignores: ['test/integration/**'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
      },
    },
  },
  {
    files: ['test/integration/**/*.ts', 'test/integration/**/*.mts'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...vitestGlobals,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts', '*.mts'],
          defaultConfig: './tsconfig.json',
        },
      },
    },
  },
];
