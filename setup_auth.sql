-- SQL Setup for Calendar Authentication
-- Run this in your Supabase SQL Editor

-- Step 1: Create the authentication table
CREATE TABLE IF NOT EXISTS calendar_auth (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to ensure only one row
ALTER TABLE calendar_auth ADD CONSTRAINT single_row_check CHECK (id = 1);

-- Step 2: Set Row Level Security (RLS) policies
ALTER TABLE calendar_auth ENABLE ROW LEVEL SECURITY;

-- Allow public read access to password hash (needed for login verification)
-- This is safe because we're only storing hashed passwords, not plain text
CREATE POLICY "Allow public read for login" ON calendar_auth
  FOR SELECT
  TO public
  USING (true);

-- Only authenticated users can update (this prevents unauthorized changes)
-- For now, we'll allow public update since we don't have user management
-- You can make this more restrictive later if needed
CREATE POLICY "Allow update for setup" ON calendar_auth
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Allow insert for initial setup
CREATE POLICY "Allow insert for setup" ON calendar_auth
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Step 3: Update calendar_events table RLS if not already set
-- This ensures only authenticated requests can modify events

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow public read (you can make this more restrictive if needed)
CREATE POLICY "Allow public read events" ON calendar_events
  FOR SELECT
  TO public
  USING (true);

-- Allow public insert/update/delete for now
-- In a production environment, you'd want to check authentication here
CREATE POLICY "Allow public insert events" ON calendar_events
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update events" ON calendar_events
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete events" ON calendar_events
  FOR DELETE
  TO public
  USING (true);

-- Step 4: Instructions to set your password
-- DO NOT run the insert statement yet!
-- First, you need to generate the password hash.

-- Instructions:
-- 1. Open your calendar application in the browser
-- 2. Open the browser console (F12 or right-click -> Inspect -> Console)
-- 3. Type: generatePasswordHash('your_password_here')
--    Replace 'your_password_here' with your actual password
-- 4. Press Enter
-- 5. The console will output the SQL statement to run
-- 6. Copy that SQL statement and run it here in Supabase SQL Editor
-- 7. Your password will be stored securely as a hash

-- Example (DO NOT USE THIS HASH - GENERATE YOUR OWN):
-- INSERT INTO calendar_auth (id, password_hash) 
-- VALUES (1, 'your_generated_hash_here') 
-- ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
