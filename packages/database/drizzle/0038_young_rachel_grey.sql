-- Migration: Add STAFF_MANAGER RBAC profile
-- Previous: 0037_maintenance_profiles
-- Description: Add STAFF_MANAGER to admin_role enum for constrained staff management

ALTER TYPE "public"."admin_role" ADD VALUE 'STAFF_MANAGER';
