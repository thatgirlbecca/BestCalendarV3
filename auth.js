// auth.js - Supabase authentication

const AUTH_STORAGE_KEY = 'calendar_auth_token';
const SESSION_CHECK_INTERVAL = 60000; // Check session every minute

// Check if user is authenticated
async function isAuthenticated() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      return false;
    }
    
    return !!session;
  } catch (err) {
    console.error('Exception checking auth:', err);
    return false;
  }
}

// Sign in with Supabase
async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Error signing in:', error.message);
      return { success: false, error: error.message };
    }
    
    if (data.session) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
      return { success: true, user: data.user };
    }
    
    return { success: false, error: 'No session created' };
  } catch (err) {
    console.error('Exception signing in:', err);
    return { success: false, error: 'An error occurred during sign in' };
  }
}

// Clear authentication
async function clearAuth() {
  try {
    await supabaseClient.auth.signOut();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.error('Error signing out:', err);
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('login-error');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Clear previous error
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
  
  // Sign in with Supabase
  const result = await signInWithEmail(email, password);
  
  if (result.success) {
    // Show calendar, hide login
    showCalendar();
    
    console.log('Login successful, checking for initializeCalendar...');
    console.log('typeof initializeCalendar:', typeof initializeCalendar);
    
    // Initialize calendar (call the initialization function from calendar.js)
    if (typeof initializeCalendar === 'function') {
      console.log('Calling initializeCalendar()');
      initializeCalendar();
    } else {
      console.error('initializeCalendar is not defined!');
    }
  } else {
    // Show error
    errorDiv.textContent = result.error || 'Invalid credentials. Please try again.';
    errorDiv.style.display = 'block';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

// Show calendar screen
function showCalendar() {
  document.getElementById('login-screen').style.display = 'none';
  
  // Check which app is present (calendar or todo)
  const calendarEl = document.getElementById('calendar');
  const todoEl = document.getElementById('todo-app');
  
  if (calendarEl) {
    calendarEl.style.display = 'flex';
  }
  if (todoEl) {
    todoEl.style.display = 'flex';
  }
}

// Show login screen
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  
  // Hide whichever app is present
  const calendarEl = document.getElementById('calendar');
  const todoEl = document.getElementById('todo-app');
  
  if (calendarEl) {
    calendarEl.style.display = 'none';
  }
  if (todoEl) {
    todoEl.style.display = 'none';
  }
  
  // Clear password field
  const passwordInput = document.getElementById('login-password');
  if (passwordInput) {
    passwordInput.value = '';
  }
  const emailInput = document.getElementById('login-email');
  if (emailInput) {
    emailInput.value = '';
    emailInput.focus();
  }
}

// Initialize authentication on page load
function initAuth() {
  if (isAuthenticated()) {
    showCalendar();
    return true;
  }
}

// Handle logout
async function handleLogout() {
  await clearAuth();
  showLogin();
}

// Check authentication status on page load
async function checkAuthOnLoad() {
  try {
    // Wait a moment for Supabase to initialize from localStorage
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const authenticated = await isAuthenticated();
    
    if (authenticated) {
      showCalendar();
      if (typeof initializeCalendar === 'function') {
        initializeCalendar();
      }
      return true;
    } else {
      showLogin();
      return false;
    }
  } catch (err) {
    console.error('Error checking auth on load:', err);
    showLogin();
    return false;
  }
}

// Monitor session state
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_OUT') {
    showLogin();
  } else if (event === 'SIGNED_IN' && session) {
    showCalendar();
  }
});