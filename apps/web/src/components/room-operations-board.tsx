'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';

function localDate(value: Date): string {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

function dateRange(value: string): { from: string; to: string } {
  return { from: new Date(`${value}T00:00:00`).toISOString(), to: new Date(`${value}T23:59:59.999`).toISOString() };
}

export function RoomOperationsBoard() {
  const [date, setDate] = useState(() => localDate(new Date()));
  const [data, setData] = useState<AdminRoomOperationsResponse>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return adminApi.getRoomOperations(dateRange(date)).then(setData).catch((cause: unknown) => {
      setError(cause instanceof AdminApiError ? cause.message : 'Unable to load room operations.');
    });
  }, [date]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [data?.generatedAt]);

  return (
    <section className="room-operations-board" aria-labelledby="room-board-heading">
      <div className="page-heading">
        <div><h2 id="room-board-heading">Room operations board</h2><p>Server-supplied room occupancy, maintenance and housekeeping for one day.</p></div>
        <p aria-live="polite">{data === undefined ? 'Loading…' : `Updated ${new Date(data.generatedAt).toLocaleTimeString()}`}{stale ? ' · Refresh recommended' : ''}</p>
      </div>
      <label>Schedule date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <button className="primary-button" onClick={() => void refresh()} type="button">Refresh board</button>
      {error ? <p role="alert">{error}</p> : null}
      {data !== undefined && data.items.length === 0 ? <p className="table-empty">No physical rooms are configured.</p> : null}
      {data !== undefined && data.items.length > 0 ? <ul className="room-board-list">
        {data.items.map((room) => <li key={room.roomId}>
          <div><strong>Room {room.roomNumber}</strong><span>{room.roomStatus} · Housekeeping: {room.housekeepingStatus} · {room.maintenanceState === 'ACTIVE' ? 'Maintenance active' : 'No maintenance'}</span></div>
          {room.bookings.length === 0 ? <p>No occupied booking span in this range.</p> : <ul>{room.bookings.map((booking) => <li key={booking.bookingCode}><Link href={`/admin/bookings/${booking.bookingCode}`}>{booking.bookingCode}</Link> · {booking.status} · {new Date(booking.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(booking.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>)}</ul>}
        </li>)}
      </ul> : null}
    </section>
  );
}
