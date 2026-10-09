-- =============================================================================
-- Migration: 001_create_profiles_and_roles.sql
-- Description: Creates the profiles table linked to auth.users, role enum,
--              and all Row Level Security policies.
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Step 1: Create role enum
-- Two roles: 'pg_owner' manages properties; 'tenant' is a renter.
-- New users are assigned 'pg_owner' by default (the most common use-case
-- for self-registration). Tenant accounts are created by owners, not
-- self-registered. This prevents privilege escalation.
CREATE TYPE user_role AS ENUM ('pg_owner', 'tenant');

-- Step 2: Create profiles table
-- One row per auth.users entry. Created automatically via trigger.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL DEFAULT '',
  phone       TEXT,
  role        user_role   NOT NULL DEFAULT 'pg_owner',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies

-- 4a. Users can read only their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 4b. Users can update only their own profile
--     CRITICAL: role column is excluded from user updates (enforced below)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4c. No direct INSERT allowed from client — profiles are created by trigger only
-- (The trigger below handles INSERT; clients cannot insert profiles directly)

-- 4d. No DELETE allowed from client
-- (Account deletion is handled server-side / admin only)

-- Step 5: Prevent role self-escalation
-- Users cannot change their own role column. Only service_role can.
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is being changed and caller is not service_role, reject it
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'You are not allowed to change your own role.';
  END IF;
  -- Always update updated_at
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_role_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- Step 6: Auto-create profile on user signup
-- Triggered when a new row is inserted into auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pg_owner'  -- Default role for self-registered users
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Updated_at auto-update function (reusable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
