import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AvailabilitySearchForm } from './availability-search-form';
const meta = {
  title: 'Booking/AvailabilitySearchForm',
  component: AvailabilitySearchForm,
} satisfies Meta<typeof AvailabilitySearchForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
