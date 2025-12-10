-- Fix RLS Policies for Calendar Events
-- Run this in Supabase SQL Editor if events aren't saving

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow public read events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public insert events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public update events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public delete events" ON calendar_events;

-- Disable RLS temporarily to test (you can re-enable with policies later)
ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled with proper policies:
-- ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow all operations" ON calendar_events
--   FOR ALL
--   TO public
--   USING (true)
--   WITH CHECK (true);
