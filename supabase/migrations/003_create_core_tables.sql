-- =============================================================================
-- Migration: 003_create_core_tables.sql
-- Description: Creates properties, rooms, tenants, and payments tables with
--              full RLS policies, recursion-safe security helpers, indexes,
--              and auto-sync triggers. All tables are scoped to the PG owner.
-- Run this in: Supabase Dashboard → SQL Editor
-- Run AFTER: 001_create_profiles_and_roles.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Enum types (idempotent creation)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE room_status AS ENUM ('vacant', 'occupied', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'partial', 'waived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'bank_transfer', 'cheque', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Ensure timestamp trigger function exists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Core Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. TABLE: properties
-- A PG owner can manage multiple properties (buildings/hostels).
CREATE TABLE IF NOT EXISTS public.properties (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  address     TEXT        NOT NULL DEFAULT '',
  city        TEXT        NOT NULL DEFAULT '',
  total_rooms INT         NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3b. TABLE: rooms
-- Each room belongs to a property.
CREATE TABLE IF NOT EXISTS public.rooms (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID          NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number     TEXT          NOT NULL,
  floor           TEXT,
  monthly_rent    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monthly_rent >= 0),
  deposit_amount  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  status          room_status   NOT NULL DEFAULT 'vacant',
  amenities       TEXT[],
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, room_number)
);

-- 3c. TABLE: tenants
-- A tenant is linked to a room and optionally to a Supabase auth user.
CREATE TABLE IF NOT EXISTS public.tenants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID        NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name         TEXT        NOT NULL,
  email             TEXT,
  phone             TEXT,
  emergency_contact TEXT,
  move_in_date      DATE        NOT NULL,
  move_out_date     DATE,
  active            BOOLEAN     NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3d. TABLE: payments
-- Rent payment records per tenant.
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID           NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2)  NOT NULL CHECK (amount > 0),
  due_date        DATE           NOT NULL,
  paid_date       DATE,
  status          payment_status NOT NULL DEFAULT 'pending',
  method          payment_method,
  reference_no    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Performance Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_property_id ON public.rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON public.tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(active);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: RLS Helper Functions (SECURITY DEFINER prevents policy recursion)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_property_owner(property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = property_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_owner(room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = room_id AND p.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.rooms r ON r.id = t.room_id
    JOIN public.properties p ON p.id = r.property_id
    WHERE t.id = tenant_id AND p.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_in_room(room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE room_id = room_id AND user_id = auth.uid() AND active = true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Enable Row Level Security & Configure Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage own properties" ON public.properties;
CREATE POLICY "Owners can manage own properties"
  ON public.properties
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 6b. rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage rooms in own properties" ON public.rooms;
CREATE POLICY "Owners can manage rooms in own properties"
  ON public.rooms
  FOR ALL
  USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id));

DROP POLICY IF EXISTS "Tenants can view own room" ON public.rooms;
CREATE POLICY "Tenants can view own room"
  ON public.rooms
  FOR SELECT
  USING (public.is_tenant_in_room(id));

-- 6c. tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage tenants in own rooms" ON public.tenants;
CREATE POLICY "Owners can manage tenants in own rooms"
  ON public.tenants
  FOR ALL
  USING (public.is_room_owner(room_id))
  WITH CHECK (public.is_room_owner(room_id));

DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
CREATE POLICY "Tenants can view own record"
  ON public.tenants
  FOR SELECT
  USING (user_id = auth.uid());

-- 6d. payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage payments for own tenants" ON public.payments;
CREATE POLICY "Owners can manage payments for own tenants"
  ON public.payments
  FOR ALL
  USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

DROP POLICY IF EXISTS "Tenants can view own payments" ON public.payments;
CREATE POLICY "Tenants can view own payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE tenants.id = payments.tenant_id
        AND tenants.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7: Triggers - auto-update updated_at for all core tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_properties_updated_at ON public.properties;
CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 8: Auto-sync room status when tenant is added/deactivated
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_room_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On insert/update, if tenant is active, mark room occupied
  IF TG_OP = 'INSERT' AND NEW.active = true THEN
    UPDATE public.rooms SET status = 'occupied' WHERE id = NEW.room_id;
  END IF;

  -- If tenant deactivated (move-out), check if any other active tenant remains
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants
      WHERE room_id = NEW.room_id AND active = true AND id != NEW.id
    ) THEN
      UPDATE public.rooms SET status = 'vacant' WHERE id = NEW.room_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_room_status_on_tenant_change ON public.tenants;
CREATE TRIGGER sync_room_status_on_tenant_change
  AFTER INSERT OR UPDATE OF active ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_status();
