import type { Preview } from '@storybook/nextjs-vite';

import '../apps/web/src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: 'fullscreen',
  },
};

export default preview;
