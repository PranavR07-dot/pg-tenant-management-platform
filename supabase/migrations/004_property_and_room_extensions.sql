-- =============================================================================
-- Migration: 004_property_and_room_extensions.sql
-- Description: Adds optional description and contact details to properties,
--              and room_type and capacity to rooms.
-- Run this in: Supabase Dashboard → SQL Editor
-- Run AFTER: 003_create_core_tables.sql
-- =============================================================================

-- Add optional description and contact number to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Add optional room_type and capacity to rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 1 CHECK (capacity >= 1);
