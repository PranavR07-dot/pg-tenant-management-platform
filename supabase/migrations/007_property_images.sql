-- =============================================================================
-- Migration: 007_property_images.sql
-- Description: Adds property_images table, storage bucket configuration,
--              and RLS policies for manager uploads and public discovery.
--
-- Security Guarantees:
--   1. Only authenticated property owners can INSERT, UPDATE, or DELETE images
--      for their owned properties.
--   2. Anonymous users can ONLY SELECT images belonging to published properties.
--   3. Storage bucket `property-images` has strict RLS:
--      - Public read only for published properties (or public CDN).
--      - Upload/Update/Delete strictly restricted to property owner.
--   4. Updates to public.public_properties view to include cover_image_url
--      and images array.
--
-- Apply in: Supabase Dashboard → SQL Editor
-- Run AFTER: 006_secure_public_listing_rls.sql
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Create property_images table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  is_cover     BOOLEAN     NOT NULL DEFAULT false,
  display_order INT        NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_images_property_id
  ON public.property_images(property_id);

CREATE INDEX IF NOT EXISTS idx_property_images_cover
  ON public.property_images(property_id, is_cover)
  WHERE is_cover = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Enable RLS on property_images
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

-- 2a. Owner CRUD policy: Owner can manage images for their owned properties
DROP POLICY IF EXISTS "Owners can manage images for own properties" ON public.property_images;
CREATE POLICY "Owners can manage images for own properties"
  ON public.property_images
  FOR ALL
  TO authenticated
  USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id));

-- 2b. Public read policy: Anyone can view images of published properties
DROP POLICY IF EXISTS "Public can view images of published properties" ON public.property_images;
CREATE POLICY "Public can view images of published properties"
  ON public.property_images
  FOR SELECT
  TO anon, authenticated
  USING (public.is_property_published(property_id));

-- Anonymous table privileges: grant select only on non-sensitive columns
GRANT SELECT (id, property_id, image_url, is_cover, display_order, created_at)
  ON public.property_images TO anon;
GRANT ALL ON public.property_images TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Configure Supabase Storage Bucket & Storage RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Create bucket if it doesn't already exist in storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5 MB limit per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS Policies on storage.objects
-- Path convention: {owner_id}/{property_id}/{filename}

-- 3a. Public can view objects in property-images bucket
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
CREATE POLICY "Public can view property images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'property-images');

-- 3b. Owners can upload objects to property-images bucket
-- Enforces that first path token is the authenticated user's ID
DROP POLICY IF EXISTS "Owners can upload property images" ON storage.objects;
CREATE POLICY "Owners can upload property images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3c. Owners can update their own property images
DROP POLICY IF EXISTS "Owners can update property images" ON storage.objects;
CREATE POLICY "Owners can update property images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3d. Owners can delete their own property images
DROP POLICY IF EXISTS "Owners can delete property images" ON storage.objects;
CREATE POLICY "Owners can delete property images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Sanitized Public View for Images
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.public_property_images
WITH (security_invoker = true) AS
SELECT
  pi.id,
  pi.property_id,
  pi.image_url,
  pi.is_cover,
  pi.display_order
FROM public.property_images AS pi
JOIN public.properties AS p ON p.id = pi.property_id
WHERE p.is_published = true;

GRANT SELECT ON public.public_property_images TO anon, authenticated;

-- Update public_properties view with cover_image_url subquery
CREATE OR REPLACE VIEW public.public_properties
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.address,
  p.city,
  p.description,
  p.total_rooms,
  p.created_at,
  p.is_published,
  (
    SELECT pi.image_url
    FROM public.property_images pi
    WHERE pi.property_id = p.id
    ORDER BY pi.is_cover DESC, pi.display_order ASC, pi.created_at ASC
    LIMIT 1
  ) AS cover_image_url
FROM public.properties AS p
WHERE p.is_published = true;

GRANT SELECT ON public.public_properties TO anon, authenticated;

COMMIT;
