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

// ============================================
// TODO FUNCTIONS
// ============================================

// Create a new todo
async function createTodo(todoData) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    console.error('Cannot create todo: user not authenticated');
    return null;
  }

  const payload = {
    user_id: user.id,
    text: todoData.text,
    description: todoData.description || null,
    importance: todoData.importance || 4,
    start_date: todoData.startDate || null,
    due_date: todoData.dueDate || null,
    completed: false,
    archived: false,
    labels: todoData.labels || [],
    recurrence_rule: todoData.recurrenceRule || null,
    recurrence_interval: todoData.recurrenceInterval || null,
    recurrence_days: todoData.recurrenceDays || null,
    recurrence_end_date: todoData.recurrenceEndDate || null,
    recurrence_count: todoData.recurrenceCount || null,
    recurrence_type: todoData.recurrenceType || 'schedule',
    excluded_dates: []
  };

  const { data, error } = await supabaseClient
    .from('todos')
    .insert([payload])
    .select();

  if (error) {
    console.error('Error creating todo:', error);
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Get all todos (with optional filters)
async function getTodos(filters = {}) {
  let query = supabaseClient
    .from('todos')
    .select('*')
    .order('importance', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.archived !== undefined) {
    query = query.eq('archived', filters.archived);
  }
  if (filters.completed !== undefined) {
    query = query.eq('completed', filters.completed);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching todos:', error);
    return [];
  }
  return data || [];
}

// Update a todo
async function updateTodo(todoId, updates) {
  const { data, error } = await supabaseClient
    .from('todos')
    .update(updates)
    .eq('id', todoId)
    .select();

  if (error) {
    console.error('Error updating todo:', error);
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

// Delete a todo
async function deleteTodo(todoId) {
  const { error } = await supabaseClient
    .from('todos')
    .delete()
    .eq('id', todoId);

  if (error) {
    console.error('Error deleting todo:', error);
    return false;
  }
  return true;
}

// Mark todo as completed
async function completeTodo(todoId) {
  const { data: todo, error: fetchError } = await supabaseClient
    .from('todos')
    .select('*')
    .eq('id', todoId)
    .single();

  if (fetchError || !todo) {
    console.error('Error fetching todo:', fetchError);
    return null;
  }

  // If recurring, create a new occurrence
  if (todo.recurrence_rule) {
    // Check if we've reached the recurrence count limit
    let shouldCreateNext = true;
    
    if (todo.recurrence_count) {
      // Count how many times this task has been completed
      const { data: completedTodos, error: countError } = await supabaseClient
        .from('todos')
        .select('id')
        .eq('text', todo.text)
        .eq('completed', true);
      
      if (!countError && completedTodos) {
        // +1 for the current completion
        const totalCompleted = completedTodos.length + 1;
        if (totalCompleted >= todo.recurrence_count) {
          shouldCreateNext = false;
        }
      }
    }
    
    if (shouldCreateNext) {
      let nextStartDate = null;
      const interval = todo.recurrence_interval || 1;
      
      // Calculate the duration between start_date and due_date (in days)
      let daysDuration = null;
      if (todo.start_date && todo.due_date) {
        const startDate = new Date(todo.start_date + 'T00:00:00');
        const dueDate = new Date(todo.due_date + 'T00:00:00');
        daysDuration = Math.round((dueDate - startDate) / (1000 * 60 * 60 * 24));
      }
      
      // Calculate next start date based on recurrence type
      if (todo.recurrence_type === 'after_completion') {
        // After completion: calculate from completion date
        const completionDate = new Date();
        
        switch (todo.recurrence_rule) {
          case 'DAILY':
            nextStartDate = new Date(completionDate);
            nextStartDate.setDate(nextStartDate.getDate() + interval);
            break;
          
          case 'WEEKLY':
            nextStartDate = new Date(completionDate);
            nextStartDate.setDate(nextStartDate.getDate() + (interval * 7));
            break;
          
          case 'MONTHLY':
            nextStartDate = new Date(completionDate);
            nextStartDate.setMonth(nextStartDate.getMonth() + interval);
            break;
          
          case 'YEARLY':
            nextStartDate = new Date(completionDate);
            nextStartDate.setFullYear(nextStartDate.getFullYear() + interval);
            break;
        }
      } else {
        // On schedule: calculate from the original start date
        const originalStart = todo.start_date ? new Date(todo.start_date + 'T00:00:00') : new Date();
        
        switch (todo.recurrence_rule) {
          case 'DAILY':
            nextStartDate = new Date(originalStart);
            nextStartDate.setDate(nextStartDate.getDate() + interval);
            break;
          
          case 'WEEKLY':
            nextStartDate = new Date(originalStart);
            nextStartDate.setDate(nextStartDate.getDate() + (interval * 7));
            break;
          
          case 'MONTHLY':
            nextStartDate = new Date(originalStart);
            nextStartDate.setMonth(nextStartDate.getMonth() + interval);
            break;
          
          case 'YEARLY':
            nextStartDate = new Date(originalStart);
            nextStartDate.setFullYear(nextStartDate.getFullYear() + interval);
            break;
          
          case 'CUSTOM_DAYS':
            // For custom days (e.g., every Monday, Wednesday), find the next occurrence
            if (todo.recurrence_days && todo.recurrence_days.length > 0) {
              const today = new Date();
              const dayNumbers = todo.recurrence_days.map(day => {
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                return days.indexOf(day.toLowerCase());
              });
              
              // Find the next day in the recurrence pattern
              nextStartDate = new Date(today);
              nextStartDate.setDate(nextStartDate.getDate() + 1); // Start from tomorrow
              
              for (let i = 0; i < 7; i++) {
                if (dayNumbers.includes(nextStartDate.getDay())) {
                  break;
                }
                nextStartDate.setDate(nextStartDate.getDate() + 1);
              }
            }
            break;
        }
      }
      
      // Calculate next due date if original had one
      let nextDueDate = null;
      if (nextStartDate && todo.due_date && daysDuration !== null) {
        nextDueDate = new Date(nextStartDate);
        nextDueDate.setDate(nextDueDate.getDate() + daysDuration);
      }
      
      // Create new todo occurrence
      if (nextStartDate) {
        const newTodoData = {
          text: todo.text,
          description: todo.description,
          importance: todo.importance,
          startDate: nextStartDate.toISOString().split('T')[0],
          dueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          labels: todo.labels,
          recurrenceRule: todo.recurrence_rule,
          recurrenceInterval: todo.recurrence_interval,
          recurrenceDays: todo.recurrence_days,
          recurrenceEndDate: todo.recurrence_end_date,
          recurrenceCount: todo.recurrence_count,
          recurrenceType: todo.recurrence_type
        };
        
        await createTodo(newTodoData);
      }
    }
  }

  // Mark the current todo as completed
  return await updateTodo(todoId, {
    completed: true,
    completed_at: new Date().toISOString()
  });
}

// Mark todo as incomplete
async function incompleteTodo(todoId) {
  return await updateTodo(todoId, {
    completed: false,
    completed_at: null
  });
}

// Archive a todo
async function archiveTodo(todoId) {
  return await updateTodo(todoId, { archived: true });
}

// Unarchive a todo
async function unarchiveTodo(todoId) {
  return await updateTodo(todoId, { archived: false });
}

// Subscribe to real-time changes on the calendar_events table
function subscribeToChanges(callback) {
  return supabaseClient
    .channel('calendar_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, callback)
    .subscribe();
}
