-- =============================================================================
-- Migration: 005_tenant_management_enhancements.sql
-- Description: Adds optional monthly_rent and deposit_amount to tenants table
--              for custom agreed lease pricing, and improves room status
--              synchronization on room transfers and reactivations.
-- Run this in: Supabase Dashboard → SQL Editor
-- Run AFTER: 004_property_and_room_extensions.sql
-- =============================================================================

-- Add optional custom monthly_rent and deposit_amount to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(10,2) CHECK (monthly_rent >= 0),
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) CHECK (deposit_amount >= 0);

-- Enhanced trigger to handle room transfers and reactivations
CREATE OR REPLACE FUNCTION public.sync_room_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. When a new tenant is inserted as active
  IF TG_OP = 'INSERT' AND NEW.active = true THEN
    UPDATE public.rooms SET status = 'occupied' WHERE id = NEW.room_id;
  END IF;

  -- 2. When an existing tenant is moved to a different room
  IF TG_OP = 'UPDATE' AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
    -- If active, new room becomes occupied
    IF NEW.active = true THEN
      UPDATE public.rooms SET status = 'occupied' WHERE id = NEW.room_id;
    END IF;
    -- Old room: if no active tenants left, become vacant
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants
      WHERE room_id = OLD.room_id AND active = true AND id != NEW.id
    ) THEN
      UPDATE public.rooms SET status = 'vacant' WHERE id = OLD.room_id;
    END IF;
  END IF;

  -- 3. When an active tenant moves out (active: true -> false)
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants
      WHERE room_id = NEW.room_id AND active = true AND id != NEW.id
    ) THEN
      UPDATE public.rooms SET status = 'vacant' WHERE id = NEW.room_id;
    END IF;
  END IF;

  -- 4. When an inactive tenant is reactivated (active: false -> true)
  IF TG_OP = 'UPDATE' AND OLD.active = false AND NEW.active = true THEN
    UPDATE public.rooms SET status = 'occupied' WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_room_status_on_tenant_change ON public.tenants;
CREATE TRIGGER sync_room_status_on_tenant_change
  AFTER INSERT OR UPDATE OF active, room_id ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_status();
