-- Migration: Add physical room notes field
-- Previous: 0035_add_operational_profiles
-- Description: Add optional notes field to rooms table for room-specific operational information

-- Add notes column to rooms table
ALTER TABLE rooms ADD COLUMN notes TEXT;

-- Add check constraint for trimmed notes
ALTER TABLE rooms ADD CONSTRAINT rooms_notes_trimmed_ck CHECK (
  notes IS NULL OR btrim(notes) = notes
);

-- Add length constraint for notes
ALTER TABLE rooms ADD CONSTRAINT rooms_notes_length_ck CHECK (
  notes IS NULL OR length(notes) <= 2000
);
