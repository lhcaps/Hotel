import Link from 'next/link';
import { cookies } from 'next/headers';

import { AvailabilitySearchForm } from '../../../components/availability-search-form';
import { RoomDetailQuoteAction } from '../../../components/room-detail-quote-action';
import { readBookingSearchQuery } from '../../../lib/booking-search-state';
import { resolveLocale, translate } from '../../../lib/i18n/messages';
import { loadPublicRoomType, publicRoomImage } from '../../../lib/public-room-catalog';

export default async function PublicRoomDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ roomTypeId }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const room = await loadPublicRoomType(roomTypeId);
  const locale = resolveLocale(cookieStore.get('room_locale')?.value);
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
  const intervalState = readBookingSearchQuery(search);
  const searchString = search.toString();
  return (
    <main className="rooms-catalog" id="main-content">
      <Link href={search.size > 0 ? `/booking/search?${searchString}` : '/rooms'}>
        {translate(locale, 'catalog.backToResults')}
      </Link>
      {room === null ? (
        <p className="rooms-catalog__status" role="alert">
          {translate(locale, 'search.loadErrorHelp')}
        </p>
      ) : (
        <section className="room-detail" data-testid="room-detail">
          <img alt={room.name} src={publicRoomImage(room.id)} />
          <div>
            <p>{translate(locale, 'public.roomsPricing')}</p>
            <h1>{room.name}</h1>
            {room.description === null ? null : <p>{room.description}</p>}
            <p className="room-detail__capacity">
              {translate(locale, 'search.capacity', { count: room.maxOccupancy })}
            </p>
            <h2>{translate(locale, 'catalog.amenities')}</h2>
            {room.amenities.length > 0 ? (
              <ul className="room-detail__amenities">
                {room.amenities.map((amenity) => (
                  <li key={amenity.name}>{amenity.name}</li>
                ))}
              </ul>
            ) : (
              <p>{translate(locale, 'catalog.amenitiesHelp')}</p>
            )}
            {intervalState === undefined ? (
              <p className="rooms-catalog__status">{translate(locale, 'catalog.statusPrompt')}</p>
            ) : null}
            {intervalState === undefined ? (
              <section
                aria-labelledby="room-detail-browse-heading"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                data-testid="room-detail-browse-cta"
              >
                <h2 id="room-detail-browse-heading" className="text-lg font-semibold">
                  {translate(locale, 'roomDetail.browseHeading')}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {translate(locale, 'roomDetail.browseHelp')}
                </p>
                <div className="mt-4">
                  <AvailabilitySearchForm variant="search" />
                </div>
              </section>
            ) : (
              <>
                <p className="rooms-catalog__status" data-testid="room-detail-selected-interval">
                  {translate(locale, 'roomDetail.browseHelp')}
                </p>
                <RoomDetailQuoteAction roomTypeId={roomTypeId} search={searchString} />
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
