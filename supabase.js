// supabase.js - Minimal Supabase helper (cleaned)

// Create a Supabase client using the config from `config.js`.
// We use a different variable name (`supabaseClient`) to avoid shadowing the
// global `supabase` namespace provided by the CDN.
const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// Sign in with email/password
async function signIn(email, password) {
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      console.error('Error signing in:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception signing in:', err);
    return false;
  }
}

// Sign out
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error('Error signing out:', error);
}

// Get current user (returns null if not signed in)
async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data ? data.user : null;
}

// Create a new event
async function createEvent(eventData) {
  // Get current user
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    console.error('Cannot create event: user not authenticated');
    return null;
  }

  const payload = {
    user_id: user.id,
    title: eventData.title || null,
    description: eventData.description || null,
    location: eventData.location || null,
    color: eventData.color || null,
    start_date: eventData.startDate || null,
    end_date: eventData.endDate || null,
    is_all_day: !!eventData.isAllDay,
    start_time: eventData.isAllDay ? null : (eventData.startTime || null),
    end_time: eventData.isAllDay ? null : (eventData.endTime || null),
    recurrence_rule: eventData.recurrenceRule || null,
    recurrence_interval: eventData.recurrenceInterval || null,
    recurrence_days: eventData.recurrenceDays || null,
    recurrence_end_date: eventData.recurrenceEndDate || null,
    recurrence_count: eventData.recurrenceCount || null,
    nth_week: eventData.nthWeek || null,
    nth_weekday: eventData.nthWeekday || null
  };

  const { data, error } = await supabaseClient
    .from('calendar_events')
    .insert([payload])
    .select();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Get events between two dates (ISO YYYY-MM-DD strings expected)
async function getEvents(startDate, endDate) {
  // Fetch events that:
  // 1. Start within the date range (non-recurring or first occurrence in range)
  // 2. OR are recurring and started before endDate and either have no end date or end after startDate
  const { data, error } = await supabaseClient
    .from('calendar_events')
    .select('*')
    .or(`start_date.gte.${startDate},and(recurrence_rule.neq.,recurrence_rule.not.is.null)`)
    .lte('start_date', endDate)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }
  
  // Filter to only include events relevant to the range
  const filtered = (data || []).filter(ev => {
    // Non-recurring events must be in range
    if (!ev.recurrence_rule || ev.recurrence_rule === '' || ev.recurrence_rule === 'NONE') {
      return ev.start_date >= startDate && ev.start_date <= endDate;
    }
    // Recurring events: include if they started before endDate and haven't ended before startDate
    if (ev.start_date > endDate) return false;
    if (ev.recurrence_end_date && ev.recurrence_end_date < startDate) return false;
    return true;
  });
  
  return filtered;
}

// Update an event
async function updateEvent(eventId, updates) {
  const { data, error } = await supabaseClient
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .select();

  if (error) {
    console.error('Error updating event:', error);
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Delete an event
async function deleteEvent(eventId) {
  const { error } = await supabaseClient
    .from('calendar_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('Error deleting event:', error);
    return false;
  }
  return true;
}

// Add an exception date to a recurring event (excludes a single occurrence)
async function addRecurringEventException(eventId, exceptionDate) {
  try {
    // First, get the current excluded_dates array
    const { data: event, error: fetchError } = await supabaseClient
      .from('calendar_events')
      .select('excluded_dates')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      console.error('Error fetching event:', fetchError);
      return false;
    }

    // Add the new exception date to the array
    const currentExceptions = event.excluded_dates || [];
    if (!currentExceptions.includes(exceptionDate)) {
      currentExceptions.push(exceptionDate);
    }

    // Update the event with the new excluded_dates
    const { error: updateError } = await supabaseClient
      .from('calendar_events')
      .update({ excluded_dates: currentExceptions })
      .eq('id', eventId);

    if (updateError) {
      console.error('Error updating excluded dates:', updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception adding excluded date:', err);
    return false;
  }
}

// Subscribe to real-time changes on the calendar_events table
function subscribeToChanges(callback) {
  return supabaseClient
    .channel('calendar_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, callback)
    .subscribe();
}
