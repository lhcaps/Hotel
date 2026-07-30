import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QuoteView } from './quote-view';
const meta = {
  title: 'Booking/QuoteView',
  component: QuoteView,
  args: {
    id: '00000000-0000-4000-8000-000000000001',
    context: null,
  },
} satisfies Meta<typeof QuoteView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {};
