SELECT 
  (SELECT COUNT(*) FROM quotes) as quotes,
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM room_inventory_blocks WHERE status = 'ACTIVE') as active_blocks;
