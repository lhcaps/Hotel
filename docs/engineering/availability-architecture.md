# Availability architecture

Availability returns only active room-type display/capacity data and an available count. It never returns a physical room identifier or room number.

The PostgreSQL `room_inventory_blocks` ledger is authoritative. An active block overlaps a request when `starts_at < checkOut AND ends_at > checkIn`; therefore touching `[checkIn, checkOut)` ranges remain available. Inactive rooms and inactive room types are excluded. Search and quote create no inventory block or reservation.
