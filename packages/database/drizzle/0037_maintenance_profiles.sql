-- Migration: Add maintenance RBAC profiles
-- Previous: 0036_physical_room_notes
-- Description: Add MAINTENANCE_MANAGER and MAINTENANCE_STAFF to admin_role enum

ALTER TYPE "public"."admin_role" ADD VALUE 'MAINTENANCE_MANAGER';--> statement-breakpoint
ALTER TYPE "public"."admin_role" ADD VALUE 'MAINTENANCE_STAFF';