# Calendar Authentication Setup Guide

## Overview
Your calendar now has password-based authentication. Only users with the correct password can access and modify calendar data.

## Features
- ✅ Password-protected access
- ✅ Secure SHA-256 password hashing
- ✅ 30-day persistent login (stays logged in on the device)
- ✅ Logout functionality
- ✅ Clean login screen

## Setup Instructions

### Step 1: Run the SQL Setup
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of `setup_auth.sql`
4. Paste and execute it in the SQL Editor
   - This creates the `calendar_auth` table
   - Sets up Row Level Security policies
   - Prepares your database for authentication

### Step 2: Generate Your Password Hash
1. Open your calendar application in a web browser (locally or deployed)
2. Open the browser console:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - **Safari**: Enable Developer menu first, then press `Cmd+Option+C`
3. In the console, type the following command (replace with your desired password):
   ```javascript
   generatePasswordHash('YourSecurePasswordHere')
   ```
4. Press Enter
5. The console will output:
   - The password hash
   - A SQL statement ready to run

### Step 3: Store Your Password Hash
1. Copy the SQL statement from the console output (it looks like this):
   ```sql
   INSERT INTO calendar_auth (id, password_hash) 
   VALUES (1, 'abc123...') 
   ON CONFLICT (id) DO UPDATE SET password_hash = 'abc123...';
   ```
2. Go back to your Supabase SQL Editor
3. Paste and execute the statement
4. Your password is now securely stored!

### Step 4: Test Login
1. Refresh your calendar application
2. You should see the login screen
3. Enter your password
4. Click "Login"
5. You should be redirected to the calendar

## Usage

### Staying Logged In
- After logging in, you'll stay logged in for **30 days** on that device
- Your session is stored in the browser's localStorage
- No need to login again unless you logout or 30 days pass

### Logging Out
- Click the logout button (⏻) in the top right corner of the calendar header
- This will clear your session and return you to the login screen

### Changing Your Password
1. Generate a new password hash using the console method above
2. Run the SQL update statement in Supabase
3. All devices will need to login again with the new password

## Security Notes

### What's Protected
- ✅ Password is hashed with SHA-256 (never stored in plain text)
- ✅ Hash is compared server-side via Supabase
- ✅ Login state is stored locally (not in URL or cookies)
- ✅ 30-day session expiration for security

### GitHub Safety
Since you're putting this on GitHub:
- ✅ Password hash is stored in Supabase (not in code)
- ✅ `config.js` with API keys should be in `.gitignore`
- ✅ Login functionality works even with public source code
- ⚠️ Make sure to add `config.js` to `.gitignore` before pushing to GitHub!

### Important Security Considerations
- This is a **simple authentication system** suitable for personal use
- For production/multi-user scenarios, consider:
  - More robust authentication (OAuth, JWT tokens)
  - Backend password verification (not client-side)
  - Rate limiting on login attempts
  - HTTPS-only deployment

## Troubleshooting

### "Invalid password" Error
- Double-check you entered the correct password
- Verify the password hash is correctly stored in Supabase:
  ```sql
  SELECT * FROM calendar_auth;
  ```
- Try generating and updating the hash again

### Login Screen Doesn't Appear
- Check browser console for errors
- Verify `auth.js` is loaded (check Network tab in DevTools)
- Ensure Supabase is configured correctly in `config.js`

### Session Expires Too Quickly
- The session duration is set to 30 days
- To change it, edit `SESSION_DURATION` in `auth.js`:
  ```javascript
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  ```

### Can't Access Calendar After Login
- Check browser console for errors
- Verify RLS policies are set correctly on `calendar_events` table
- Test Supabase connection is working

## Files Modified/Created

### New Files
- `auth.js` - Authentication logic
- `setup_auth.sql` - Database setup script
- `AUTH_SETUP.md` - This guide

### Modified Files
- `index.html` - Added login screen and logout button
- `styles.css` - Added login screen styles
- `calendar.js` - Added authentication check on page load

## Advanced: Change Session Duration

Edit `auth.js` line 4:
```javascript
// Current: 30 days
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

// Examples:
// 7 days:  const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
// 90 days: const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000;
// Forever: const SESSION_DURATION = Infinity;
```
