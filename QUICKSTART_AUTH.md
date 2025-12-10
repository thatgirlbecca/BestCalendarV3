# Quick Start: Setting Up Authentication

## 🚀 Quick Setup (5 minutes)

### 1. Setup Database (2 min)
```sql
-- Run this in Supabase SQL Editor
-- (Full script is in setup_auth.sql)

CREATE TABLE IF NOT EXISTS calendar_auth (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE calendar_auth ADD CONSTRAINT single_row_check CHECK (id = 1);
ALTER TABLE calendar_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for login" ON calendar_auth
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow insert for setup" ON calendar_auth
  FOR INSERT TO public WITH CHECK (true);
```

### 2. Generate Password Hash (1 min)
1. Open your calendar in browser
2. Open console (F12)
3. Run: `generatePasswordHash('your_password')`
4. Copy the SQL output

### 3. Store Password (1 min)
Paste the SQL from step 2 into Supabase SQL Editor and run it.

Example output:
```sql
INSERT INTO calendar_auth (id, password_hash) 
VALUES (1, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
```

### 4. Test Login (1 min)
1. Refresh your calendar
2. Enter your password
3. You're in! 🎉

## 📝 Before Pushing to GitHub

Make sure `config.js` is in `.gitignore`:
```bash
# Check if .gitignore exists and contains config.js
cat .gitignore | grep config.js

# If not, add it:
echo "config.js" >> .gitignore
```

Verify it's ignored:
```bash
git status
# config.js should NOT appear in the list
```

## 🔐 What You Get

- ✅ Password-protected calendar
- ✅ 30-day "remember me" on each device
- ✅ Logout button (⏻) in top-right corner
- ✅ Safe to publish on GitHub
- ✅ Password stored as SHA-256 hash (secure)

## 🎯 Common Commands

**Generate new password:**
```javascript
// Browser console
generatePasswordHash('new_password')
```

**Check if logged in:**
```javascript
// Browser console
isAuthenticated()
```

**Force logout:**
```javascript
// Browser console
clearAuth()
```

**View stored session:**
```javascript
// Browser console
console.log(localStorage.getItem('calendar_auth_token'))
console.log(localStorage.getItem('calendar_auth_timestamp'))
```

## 📖 Full Documentation
See `AUTH_SETUP.md` for detailed information and troubleshooting.
