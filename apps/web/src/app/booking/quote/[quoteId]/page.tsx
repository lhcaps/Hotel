import { QuoteView } from '../../../../components/quote-view';
export default async function QuotePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ quoteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { quoteId } = await params;
  const sp = await searchParams;
  const readParam = (key: string): string | undefined => {
    const value = sp[key];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  const roomTypeId = readParam('roomTypeId');
  const checkIn = readParam('checkIn');
  const checkOut = readParam('checkOut');
  const adults = readParam('adults');
  const children = readParam('children');
  const context =
    roomTypeId !== undefined &&
    checkIn !== undefined &&
    checkOut !== undefined &&
    adults !== undefined &&
    children !== undefined
      ? { roomTypeId, checkIn, checkOut, adults, children }
      : null;
  return <QuoteView id={quoteId} context={context} />;
}
