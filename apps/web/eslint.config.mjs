import baseConfig from '@room/eslint-config/base';

const vitestGlobals = {
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

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLLabelElement: 'readonly',
  Element: 'readonly',
  Event: 'readonly',
  SubmitEvent: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  FormData: 'readonly',
  RequestInit: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortSignal: 'readonly',
  AbortController: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
};

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...browserGlobals,
      },
    },
  },
  {
    files: ['test/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts', '*.tsx'],
          defaultConfig: './test/tsconfig.json',
        },
      },
      globals: {
        ...vitestGlobals,
        ...browserGlobals,
      },
    },
  },
];
