BEGIN;

-- 1. Publication status: private by default.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_is_published
  ON public.properties (is_published)
  WHERE is_published = true;

-- 2. Helper used by the room RLS policy.
CREATE OR REPLACE FUNCTION public.is_property_published(
  lookup_property_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties AS p
    WHERE p.id = lookup_property_id
      AND p.is_published = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_property_published(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_property_published(UUID)
  TO anon, authenticated;

-- 3. Properties: keep the existing owner CRUD policy.
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view properties"
  ON public.properties;

DROP POLICY IF EXISTS "Public can view published properties"
  ON public.properties;

CREATE POLICY "Public can view published properties"
  ON public.properties
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Remove anonymous table-wide and column-level SELECT privileges.
REVOKE SELECT ON TABLE public.properties FROM anon;
REVOKE SELECT (
  id, owner_id, name, address, city, description,
  total_rooms, contact_number, created_at, updated_at, is_published
) ON TABLE public.properties FROM anon;

-- Grant only the columns required by the public property view.
GRANT SELECT (
  id, name, address, city, description, total_rooms,
  created_at, is_published
) ON TABLE public.properties TO anon;

-- 4. Rooms: keep existing owner and tenant policies.
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rooms"
  ON public.rooms;

DROP POLICY IF EXISTS "Public can view rooms of published properties"
  ON public.rooms;

CREATE POLICY "Public can view rooms of published properties"
  ON public.rooms
  FOR SELECT
  TO anon, authenticated
  USING (public.is_property_published(property_id));

-- Restrict anonymous access to room columns needed for discovery.
REVOKE SELECT ON TABLE public.rooms FROM anon;
REVOKE SELECT (
  id, property_id, room_number, floor, monthly_rent,
  deposit_amount, status, amenities, room_type, capacity,
  created_at, updated_at
) ON TABLE public.rooms FROM anon;

GRANT SELECT (
  id, property_id, room_number, floor, monthly_rent,
  deposit_amount, status, amenities, room_type, capacity
) ON TABLE public.rooms TO anon;

-- 5. Sanitized views. Do not drop existing views first.
CREATE OR REPLACE VIEW public.public_properties
WITH (security_invoker = true) AS
SELECT
  id, name, address, city, description,
  total_rooms, created_at, is_published
FROM public.properties
WHERE is_published = true;

GRANT SELECT ON public.public_properties TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_rooms
WITH (security_invoker = true) AS
SELECT
  r.id, r.property_id, r.room_number, r.floor,
  r.monthly_rent, r.deposit_amount, r.status,
  r.amenities, r.room_type, r.capacity
FROM public.rooms AS r
JOIN public.properties AS p ON p.id = r.property_id
WHERE p.is_published = true;

GRANT SELECT ON public.public_rooms TO anon, authenticated;

-- Ensure RLS remains enabled on private tables.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;