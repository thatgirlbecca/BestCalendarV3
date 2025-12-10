// auth.js - Simple password-based authentication

const AUTH_STORAGE_KEY = 'calendar_auth_token';
const AUTH_TIMESTAMP_KEY = 'calendar_auth_timestamp';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Check if user is authenticated
function isAuthenticated() {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  const timestamp = localStorage.getItem(AUTH_TIMESTAMP_KEY);
  
  if (!token || !timestamp) {
    return false;
  }
  
  // Check if session has expired
  const now = Date.now();
  const authTime = parseInt(timestamp);
  if (now - authTime > SESSION_DURATION) {
    // Session expired, clear storage
    clearAuth();
    return false;
  }
  
  return true;
}

// Store authentication token
function setAuth(token) {
  localStorage.setItem(AUTH_STORAGE_KEY, token);
  localStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
}

// Clear authentication
function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_TIMESTAMP_KEY);
}

// Verify password against stored hash in Supabase
async function verifyPassword(password) {
  try {
    // Fetch the stored password hash from Supabase
    const { data, error } = await supabaseClient
      .from('calendar_auth')
      .select('password_hash')
      .single();
    
    if (error) {
      console.error('Error fetching auth data:', error);
      return false;
    }
    
    if (!data || !data.password_hash) {
      console.error('No password hash found in database');
      return false;
    }
    
    // Simple hash comparison (SHA-256)
    const inputHash = await hashPassword(password);
    return inputHash === data.password_hash;
  } catch (err) {
    console.error('Exception during password verification:', err);
    return false;
  }
}

// Hash password using SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('login-error');
  const password = passwordInput.value;
  
  // Clear previous error
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
  
  // Verify password
  const isValid = await verifyPassword(password);
  
  if (isValid) {
    // Generate a simple token (just a timestamp + random string for this use case)
    const token = Date.now().toString() + Math.random().toString(36).substring(2);
    setAuth(token);
    
    // Show calendar, hide login
    showCalendar();
    
    // Initialize calendar (call the initialization function from calendar.js)
    if (typeof initializeCalendar === 'function') {
      initializeCalendar();
    }
  } else {
    // Show error
    errorDiv.textContent = 'Invalid password. Please try again.';
    errorDiv.style.display = 'block';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

// Handle logout
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    clearAuth();
    showLogin();
  }
}

// Show calendar screen
function showCalendar() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('calendar').style.display = 'flex';
}

// Show login screen
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('calendar').style.display = 'none';
  
  // Clear password field
  const passwordInput = document.getElementById('login-password');
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.focus();
  }
}

// Initialize authentication on page load
function initAuth() {
  if (isAuthenticated()) {
    showCalendar();
    return true;
  } else {
    showLogin();
    return false;
  }
}

// Utility function to generate password hash (for setup)
// Call this in browser console with your password to get the hash
async function generatePasswordHash(password) {
  const hash = await hashPassword(password);
  console.log('Password hash:', hash);
  console.log('Run this SQL in Supabase:');
  console.log(`INSERT INTO calendar_auth (id, password_hash) VALUES (1, '${hash}') ON CONFLICT (id) DO UPDATE SET password_hash = '${hash}';`);
  return hash;
}
