-- =============================================================================
-- Migration: 006_public_listing_rls.sql
-- Description: Adds public (anonymous) read-only access to properties and rooms
--              for the public PG discovery feature.
--
-- SAFETY:
--   - Tenants, payments, and profiles remain completely private.
--   - Only non-sensitive property and room fields are readable publicly.
--   - Owners retain full management access via existing policies.
--   - No service-role key or secret is exposed.
--
-- Apply in: Supabase Dashboard → SQL Editor
-- Run AFTER: 005_tenant_management_enhancements.sql
-- =============================================================================

-- ── Properties: allow anonymous SELECT ───────────────────────────────────────
-- Anonymous (unauthenticated) users can read property records.
-- They cannot see tenant names, contact details, or payment data.
DROP POLICY IF EXISTS "Public can view properties" ON public.properties;
CREATE POLICY "Public can view properties"
  ON public.properties
  FOR SELECT
  USING (true);
-- Note: the existing "Owners can manage own properties" policy (FOR ALL with
-- owner_id check) continues to enforce write isolation. SELECT is now open.

-- ── Rooms: allow anonymous SELECT ────────────────────────────────────────────
-- Anonymous users can view room information (room number, type, rent, status,
-- amenities) for browsing purposes.
-- The existing "Owners can manage rooms" and "Tenants can view own room"
-- policies remain in place for writes and tenant-scoped reads.
DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
CREATE POLICY "Public can view rooms"
  ON public.rooms
  FOR SELECT
  USING (true);

-- ── Tenants: NO change — remains private ─────────────────────────────────────
-- public.tenants is NOT opened to anonymous users.
-- Tenant names, emails, phones, move-in dates, and payment details
-- are manager-only and must never be exposed publicly.

-- ── Payments: NO change — remains private ────────────────────────────────────
-- public.payments is NOT opened to anonymous users.
