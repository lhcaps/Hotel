-- ARCHIVED: Historical read-only evidence moved from repository root on 2026-08-16.
-- Scope: business-count snapshot query; not current production proof. See docs/HANDOFF.md.

SELECT 
  (SELECT COUNT(*) FROM quotes) as quotes,
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM room_inventory_blocks WHERE status = 'ACTIVE') as active_blocks;
