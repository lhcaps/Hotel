import Link from 'next/link';
import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../lib/i18n/messages';
import { loadPublicRoomCatalog, publicRoomImage } from '../../lib/public-room-catalog';
import { toPublicCatalogState } from '../../lib/public-catalog-state';

export const dynamic = 'force-dynamic';

export default async function PublicRoomsPage() {
  const [cookieStore, catalog] = await Promise.all([cookies(), loadPublicRoomCatalog()]);
  const locale = resolveLocale(cookieStore.get('room_locale')?.value);
  const state = toPublicCatalogState(catalog);
  return (
    <main className="rooms-catalog" id="main-content">
      <header className="rooms-catalog__intro">
        <p>{translate(locale, 'public.roomsPricing')}</p>
        <h1>{translate(locale, 'catalog.heading')}</h1>
        <p>{translate(locale, 'catalog.help')}</p>
        <Link className="hospitality-button" href="/#booking">
          {translate(locale, 'catalog.checkStay')}
        </Link>
      </header>
      {state.kind === 'unavailable' ? (
        <section
          aria-labelledby="rooms-catalog-status-heading"
          className="rooms-catalog__status"
          data-testid="rooms-catalog-unavailable"
          role="alert"
        >
          <h2 id="rooms-catalog-status-heading">
            {translate(locale, 'catalog.unavailableHeading')}
          </h2>
          <p>{translate(locale, 'catalog.unavailableBody')}</p>
          <Link className="hospitality-button mt-4" href="/rooms">
            {translate(locale, 'catalog.retry')}
          </Link>
        </section>
      ) : null}
      {state.kind === 'empty' ? (
        <section
          aria-labelledby="rooms-catalog-empty-heading"
          className="rooms-catalog__status"
          data-testid="rooms-catalog-empty"
        >
          <h2 id="rooms-catalog-empty-heading">{translate(locale, 'catalog.emptyHeading')}</h2>
          <p>{translate(locale, 'catalog.emptyBody')}</p>
        </section>
      ) : null}
      {state.kind === 'ready' ? (
        <section aria-label={translate(locale, 'catalog.list')} className="room-catalog-list">
          {state.catalog.items.map((room, index) => {
            const detailsHref = `/rooms/${room.id}`;
            return (
              <article className="room-catalog-list__item" key={room.id} data-room-index={index}>
                <img alt={room.name} src={publicRoomImage(room.id)} />
                <div>
                  <p className="room-catalog-list__eyebrow">
                    {translate(locale, 'public.roomsPricing')}
                  </p>
                  <h2>{room.name}</h2>
                  {room.description === null ? null : <p>{room.description}</p>}
                  <p className="room-catalog-list__capacity">
                    {translate(locale, 'search.capacity', { count: room.maxOccupancy })}
                  </p>
                  {room.amenities.length > 0 ? (
                    <ul
                      aria-label={translate(locale, 'catalog.amenities')}
                      className="room-catalog-list__amenities"
                    >
                      {room.amenities.map((amenity) => (
                        <li key={amenity.name}>{amenity.name}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="rooms-catalog__status">
                    {translate(locale, 'catalog.statusPrompt')}
                  </p>
                  <div className="room-catalog-list__actions">
                    <Link href={detailsHref}>{translate(locale, 'catalog.detailHeading')}</Link>
                    <Link href="/#booking">{translate(locale, 'search.checkOtherDate')}</Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
