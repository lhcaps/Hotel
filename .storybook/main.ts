import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../apps/web/src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: '@storybook/nextjs-vite',
};

export default config;
