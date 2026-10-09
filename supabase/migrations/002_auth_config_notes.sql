-- =============================================================================
-- Migration: 002_auth_email_templates_config.sql
-- Description: Notes on Supabase Auth configuration. This file is informational
--              only — these settings must be applied via the Supabase Dashboard.
-- =============================================================================

-- NOTE: The following cannot be applied via SQL. Use the Dashboard UI:
--
-- 1. Authentication → Providers → Email
--    ✓ Enable email provider
--    ✓ Enable "Confirm email" (email verification)
--    ✓ Set minimum password length to 8
--
-- 2. Authentication → Email Templates
--    Customize "Confirm signup" template as needed.
--    The default redirect URL for email confirmation is your Site URL.
--
-- 3. Authentication → URL Configuration
--    Site URL: http://localhost:5173  (for development)
--    Redirect URLs (add all): 
--      http://localhost:5173/auth/callback
--      http://localhost:5173/auth/confirm
--
-- 4. Authentication → Providers → Email
--    "Secure email change" → enabled
--    "Double confirm email changes" → enabled

-- This migration is a no-op SQL-wise; it documents required manual config.
SELECT 1;
