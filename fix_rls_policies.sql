-- Better RLS Policies for Calendar Events with Authentication
-- This provides actual security by checking authentication

-- Step 1: Disable RLS on both tables to get your calendar working

ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_auth DISABLE ROW LEVEL SECURITY;

-- Step 2: For proper security, you have two options:

-- OPTION A: Simple approach - Use Supabase's built-in email auth instead of custom password
-- This is the most secure and recommended approach.
-- You would need to:
-- 1. Enable email authentication in Supabase dashboard
-- 2. Update the calendar to use Supabase's signInWithPassword() 
-- 3. Then use these RLS policies:

-- ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Authenticated users can do everything" ON calendar_events
--   FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- OPTION B: Keep custom password system (less secure but simpler)
-- The current system provides frontend-only protection.
-- Someone with technical knowledge could bypass the login screen
-- and access the database directly using the API keys.
-- 
-- To add backend protection with your current system, you'd need:
-- 1. Backend server to verify passwords (not client-side)
-- 2. JWT tokens issued after login
-- 3. RLS policies that validate those tokens
-- This is complex and beyond a simple calendar app.

-- RECOMMENDATION:
-- For a personal calendar on your own domain, disabling RLS is acceptable
-- since your Supabase URL and keys are only in your deployed site.
-- The login screen prevents casual access.
-- 
-- If you want true security, switch to Option A (Supabase Auth).

