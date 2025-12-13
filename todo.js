// todo.js - Todo list functionality with full features

let todos = [];
let currentView = localStorage.getItem('todoCurrentView') || 'today'; // Load last view or default to today
let editingTodoId = null;
let showAllArchive = false; // Toggle for showing all archive items

// Sort settings per view (stored in localStorage)
const getSortSettings = () => {
  const stored = localStorage.getItem('todoSortSettings');
  return stored ? JSON.parse(stored) : {
    today: { by: 'start_date', direction: 'asc', secondaryBy: '', secondaryDirection: 'asc' },
    upcoming: { by: 'start_date', direction: 'asc', secondaryBy: '', secondaryDirection: 'asc' },
    inbox: { by: 'start_date', direction: 'asc', secondaryBy: '', secondaryDirection: 'asc' },
    archive: { by: 'start_date', direction: 'desc', secondaryBy: '', secondaryDirection: 'asc' }
  };
};

const saveSortSettings = (settings) => {
  localStorage.setItem('todoSortSettings', JSON.stringify(settings));
};

let sortSettings = getSortSettings();

// Initialize todo app on page load
window.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  await checkAuthOnLoad();
});

// Initialize the todo list after authentication
async function initializeTodoApp() {
  await loadTodos();
  setupEventListeners();
  
  // Load the last viewed section and switch to it
  const savedView = localStorage.getItem('todoCurrentView') || 'today';
  switchView(savedView);
}

// Setup event listeners
function setupEventListeners() {
  // Recurring checkbox toggle
  const recurringCheckbox = document.getElementById('todo-recurring');
  recurringCheckbox.addEventListener('change', (e) => {
    const section = document.getElementById('recurrence-section');
    section.style.display = e.target.checked ? 'block' : 'none';
  });

  // Recurrence rule change
  const ruleSelect = document.getElementById('todo-recurrence-rule');
  ruleSelect.addEventListener('change', updateRecurrenceUI);

  // Recurrence end type change
  const endTypeRadios = document.querySelectorAll('input[name="recurrence-end-type"]');
  endTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateRecurrenceEndUI);
  });
}

// Update recurrence end UI based on selected type
function updateRecurrenceEndUI() {
  const endType = document.querySelector('input[name="recurrence-end-type"]:checked')?.value;
  const dateSection = document.getElementById('recurrence-end-date-section');
  const countSection = document.getElementById('recurrence-count-section');

  dateSection.style.display = endType === 'date' ? 'block' : 'none';
  countSection.style.display = endType === 'count' ? 'block' : 'none';
}

// Update recurrence UI based on selected rule
function updateRecurrenceUI() {
  const rule = document.getElementById('todo-recurrence-rule').value;
  const intervalLabel = document.getElementById('interval-label');
  const customDaysSection = document.getElementById('custom-days-section');
  
  const labels = {
    'DAILY': 'day(s)',
    'WEEKLY': 'week(s)',
    'MONTHLY': 'month(s)',
    'YEARLY': 'year(s)',
    'CUSTOM_DAYS': 'week(s)'
  };
  
  intervalLabel.textContent = labels[rule] || 'day(s)';
  customDaysSection.style.display = rule === 'CUSTOM_DAYS' ? 'block' : 'none';
}

// Switch between views
function switchView(view) {
  currentView = view;
  showAllArchive = false; // Reset when switching views
  
  // Save the current view to localStorage
  localStorage.setItem('todoCurrentView', view);
  
  // Update active button
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.view === view) {
      btn.classList.add('active');
    }
  });
  
  // Update view title
  const titles = {
    'inbox': 'Inbox',
    'today': 'Today',
    'upcoming': 'Upcoming',
    'archive': 'Archive'
  };
  document.getElementById('view-title').textContent = titles[view];
  
  // Update sort controls to reflect this view's settings
  updateSortControlsUI();
  
  // Render filtered todos
  renderTodos();
}

// Update sort controls UI based on current view settings
function updateSortControlsUI() {
  const settings = sortSettings[currentView];
  document.getElementById('sort-select').value = settings.by;
  document.getElementById('sort-direction-btn').textContent = settings.direction === 'asc' ? '↑' : '↓';
  document.getElementById('sort-select-secondary').value = settings.secondaryBy || '';
  document.getElementById('sort-direction-btn-secondary').textContent = settings.secondaryDirection === 'asc' ? '↑' : '↓';
}

// Update sort settings when dropdown changes
function updateSort() {
  const sortBy = document.getElementById('sort-select').value;
  const secondarySortBy = document.getElementById('sort-select-secondary').value;
  sortSettings[currentView].by = sortBy;
  sortSettings[currentView].secondaryBy = secondarySortBy;
  saveSortSettings(sortSettings);
  renderTodos();
}

// Toggle sort direction
function toggleSortDirection() {
  const currentDirection = sortSettings[currentView].direction;
  sortSettings[currentView].direction = currentDirection === 'asc' ? 'desc' : 'asc';
  saveSortSettings(sortSettings);
  updateSortControlsUI();
  renderTodos();
}

// Toggle secondary sort direction
function toggleSortDirectionSecondary() {
  const currentDirection = sortSettings[currentView].secondaryDirection;
  sortSettings[currentView].secondaryDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  saveSortSettings(sortSettings);
  updateSortControlsUI();
  renderTodos();
}

// Toggle showing all archive
function toggleShowAllArchive() {
  showAllArchive = !showAllArchive;
  renderTodos();
}

// Load todos from Supabase
async function loadTodos() {
  const allTodos = await getTodos();
  todos = allTodos;
  renderTodos();
}

// Filter todos based on current view
function filterTodosForView() {
  // Use local timezone for today's date
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  switch (currentView) {
    case 'inbox':
      return todos.filter(t => !t.archived && !t.completed);
    
    case 'today':
      return todos.filter(t => 
        !t.archived && 
        !t.completed && 
        (t.due_date === today || t.start_date === today || (t.due_date && t.due_date < today))
      );
    
    case 'upcoming':
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];
      
      return todos.filter(t => {
        if (t.archived || t.completed) return false;
        
        // Check both start_date and due_date
        const startDate = t.start_date || '';
        const dueDate = t.due_date || '';
        
        // Include if:
        // 1. Due date is overdue (less than today)
        // 2. Due date is today or in the next 7 days
        // 3. Start date is today or in the next 7 days
        // 4. Has no dates but is not archived/completed
        
        const hasOverdueDueDate = dueDate && dueDate < today;
        const hasDueDateInRange = dueDate && dueDate >= today && dueDate <= sevenDaysStr;
        const hasStartDateInRange = startDate && startDate >= today && startDate <= sevenDaysStr;
        
        return hasOverdueDueDate || hasDueDateInRange || hasStartDateInRange;
      }).sort((a, b) => {
        // Sort by due date first (overdue at top), then start date
        const dateA = a.due_date || a.start_date || '9999-12-31';
        const dateB = b.due_date || b.start_date || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
    
    case 'archive':
      // Filter archived/completed todos
      let archivedTodos = todos.filter(t => t.archived || t.completed);
      
      // Sort by completion date (most recent first)
      archivedTodos.sort((a, b) => {
        const dateA = a.completed_at || a.updated_at || '';
        const dateB = b.completed_at || b.updated_at || '';
        return dateB.localeCompare(dateA);
      });
      
      // If not showing all, filter to last 10 days
      if (!showAllArchive) {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const cutoffDate = tenDaysAgo.toISOString();
        
        archivedTodos = archivedTodos.filter(t => {
          const completedDate = t.completed_at || t.updated_at || '';
          return completedDate >= cutoffDate;
        });
      }
      
      return archivedTodos;
    
    default:
      return todos;
  }
}

// Open todo form (for adding or editing)
function openTodoForm(todoId = null) {
  editingTodoId = todoId;
  const modal = document.getElementById('todo-modal');
  const form = document.getElementById('todo-form');
  const title = document.getElementById('modal-title');
  
  form.reset();
  
  // Always hide recurrence section initially for new todos
  if (!todoId) {
    document.getElementById('recurrence-section').style.display = 'none';
  }
  
  if (todoId) {
    // Editing existing todo
    title.textContent = 'Edit Todo';
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
      document.getElementById('todo-text').value = todo.text;
      document.getElementById('todo-description').value = todo.description || '';
      document.getElementById('todo-start-date').value = todo.start_date || '';
      document.getElementById('todo-due-date').value = todo.due_date || '';
      document.getElementById('todo-importance').value = todo.importance || 4;
      document.getElementById('todo-labels').value = (todo.labels || []).join(', ');
      
      if (todo.recurrence_rule) {
        document.getElementById('todo-recurring').checked = true;
        document.getElementById('recurrence-section').style.display = 'block';
        document.getElementById('todo-recurrence-type').value = todo.recurrence_type || 'schedule';
        document.getElementById('todo-recurrence-rule').value = todo.recurrence_rule;
        document.getElementById('todo-recurrence-interval').value = todo.recurrence_interval || 1;
        
        // Set recurrence end type
        if (todo.recurrence_count) {
          document.querySelector('input[name="recurrence-end-type"][value="count"]').checked = true;
          document.getElementById('todo-recurrence-count').value = todo.recurrence_count;
        } else if (todo.recurrence_end_date) {
          document.querySelector('input[name="recurrence-end-type"][value="date"]').checked = true;
          document.getElementById('todo-recurrence-end').value = todo.recurrence_end_date;
        } else {
          document.querySelector('input[name="recurrence-end-type"][value="never"]').checked = true;
        }
        
        if (todo.recurrence_rule === 'CUSTOM_DAYS' && todo.recurrence_days) {
          todo.recurrence_days.forEach(day => {
            const checkbox = document.querySelector(`#custom-days-section input[value="${day}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
        
        updateRecurrenceUI();
        updateRecurrenceEndUI();
      } else {
        // Ensure recurrence section is hidden for non-recurring todos
        document.getElementById('recurrence-section').style.display = 'none';
      }
    }
  } else {
    // Adding new todo
    title.textContent = 'Add Todo';
  }
  
  modal.style.display = 'block';
  
  // Set today's date for Today view (after modal is shown)
  if (!todoId && currentView === 'today') {
    setTimeout(() => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      document.getElementById('todo-start-date').value = today;
    }, 0);
  }
}

// Close todo form
function closeTodoForm() {
  document.getElementById('todo-modal').style.display = 'none';
  editingTodoId = null;
}

// Save todo (add or update)
async function saveTodo(event) {
  event.preventDefault();
  
  const text = document.getElementById('todo-text').value.trim();
  const description = document.getElementById('todo-description').value.trim();
  const startDate = document.getElementById('todo-start-date').value;
  const dueDate = document.getElementById('todo-due-date').value;
  const importance = parseInt(document.getElementById('todo-importance').value);
  const labelsInput = document.getElementById('todo-labels').value;
  const labels = labelsInput ? labelsInput.split(',').map(l => l.trim()).filter(l => l) : [];
  
  const isRecurring = document.getElementById('todo-recurring').checked;
  let recurrenceData = {};
  
  if (isRecurring) {
    const rule = document.getElementById('todo-recurrence-rule').value;
    const recurrenceType = document.getElementById('todo-recurrence-type').value;
    const interval = parseInt(document.getElementById('todo-recurrence-interval').value);
    const endType = document.querySelector('input[name="recurrence-end-type"]:checked')?.value;
    
    let endDate = null;
    let count = null;
    
    if (endType === 'date') {
      endDate = document.getElementById('todo-recurrence-end').value;
    } else if (endType === 'count') {
      count = parseInt(document.getElementById('todo-recurrence-count').value);
    }
    
    recurrenceData = {
      recurrenceRule: rule,
      recurrenceType: recurrenceType,
      recurrenceInterval: interval,
      recurrenceEndDate: endDate,
      recurrenceCount: count
    };
    
    if (rule === 'CUSTOM_DAYS') {
      const selectedDays = Array.from(
        document.querySelectorAll('#custom-days-section input:checked')
      ).map(cb => cb.value);
      recurrenceData.recurrenceDays = selectedDays;
    }
  }
  
  const todoData = {
    text,
    description,
    start_date: startDate || null,
    due_date: dueDate || null,
    importance,
    labels,
    ...(isRecurring ? {
      recurrence_rule: recurrenceData.recurrenceRule,
      recurrence_type: recurrenceData.recurrenceType,
      recurrence_interval: recurrenceData.recurrenceInterval,
      recurrence_end_date: recurrenceData.recurrenceEndDate,
      recurrence_count: recurrenceData.recurrenceCount,
      recurrence_days: recurrenceData.recurrenceDays || null
    } : {
      recurrence_rule: null,
      recurrence_type: 'schedule',
      recurrence_interval: null,
      recurrence_end_date: null,
      recurrence_count: null,
      recurrence_days: null
    })
  };
  
  if (editingTodoId) {
    // Update existing todo
    const result = await updateTodo(editingTodoId, todoData);
    if (!result) {
      alert('Error updating todo. Check console for details.');
      return;
    }
  } else {
    // Create new todo - use createTodo which expects camelCase
    const createData = {
      text,
      description,
      startDate,
      dueDate,
      importance,
      labels,
      ...recurrenceData
    };
    const result = await createTodo(createData);
    if (!result) {
      alert('Error creating todo. Check console for details.');
      return;
    }
  }
  
  closeTodoForm();
  await loadTodos();
}

// Toggle todo completion
async function toggleTodoComplete(event, todoId) {
  event.stopPropagation();
  
  const todo = todos.find(t => t.id === todoId);
  if (!todo) return;
  
  if (todo.completed) {
    await incompleteTodo(todoId);
  } else {
    await completeTodo(todoId);
  }
  
  await loadTodos();
}

// Delete a todo
async function deleteTodoItem(event, todoId) {
  event.stopPropagation();
  
  if (confirm('Delete this todo?')) {
    await deleteTodo(todoId);
    await loadTodos();
  }
}

// Archive a todo
async function archiveTodoItem(event, todoId) {
  event.stopPropagation();
  
  await archiveTodo(todoId);
  await loadTodos();
}

// Unarchive a todo
async function unarchiveTodoItem(event, todoId) {
  event.stopPropagation();
  
  await unarchiveTodo(todoId);
  await loadTodos();
}

// Reschedule all overdue tasks to today
// Reschedule all overdue tasks to today
async function rescheduleOverdueTasks() {
  // Get today's date in local timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const overdueTodos = todos.filter(t => 
    !t.archived && 
    !t.completed && 
    t.due_date && 
    t.due_date < today
  );
  
  if (overdueTodos.length === 0) {
    return;
  }
  
  // Update all overdue tasks
  for (const todo of overdueTodos) {
    await updateTodo(todo.id, {
      due_date: today
    });
  }
  
  await loadTodos();
}

// Render todos to the page
function renderTodos() {
  const container = document.getElementById('todo-list');
  let filteredTodos = filterTodosForView();
  
  // Apply sorting
  filteredTodos = sortTodos(filteredTodos);
  
  // Check for overdue tasks (only in Today view) - use local timezone
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const overdueTodos = todos.filter(t => 
    !t.archived && 
    !t.completed && 
    t.due_date && 
    t.due_date < today
  );
  
  if (filteredTodos.length === 0) {
    const messages = {
      'inbox': 'No tasks in your inbox. Add one above!',
      'today': 'No tasks due today.',
      'upcoming': 'No upcoming tasks.',
      'archive': showAllArchive ? 'No archived or completed tasks.' : 'No archived tasks in the last 10 days.'
    };
    container.innerHTML = `<div class="empty-state">${messages[currentView]}</div>`;
    return;
  }
  
  let html = '';
  
  // Show overdue banner in Today and Upcoming views
  if ((currentView === 'today' || currentView === 'upcoming') && overdueTodos.length > 0) {
    html += `
      <div class="overdue-banner">
        <span>⚠️ You have ${overdueTodos.length} overdue task(s)</span>
        <button class="reschedule-btn" onclick="rescheduleOverdueTasks()">Reschedule All to Today</button>
      </div>
    `;
  }
  
  // Group by date for archive view
  if (currentView === 'archive') {
    renderArchiveGrouped(filteredTodos, container);
  } else {
    html += filteredTodos.map(todo => renderTodoItem(todo)).join('');
    container.innerHTML = html;
  }
}

// Sort todos based on current view's settings
function sortTodos(todosToSort) {
  const settings = sortSettings[currentView];
  const direction = settings.direction === 'asc' ? 1 : -1;
  const secondaryDirection = settings.secondaryDirection === 'asc' ? 1 : -1;
  
  return [...todosToSort].sort((a, b) => {
    // Primary sort
    let primaryResult = compareTodosByCriteria(a, b, settings.by, direction);
    
    // If primary sort results in equality and secondary sort is defined, apply secondary sort
    if (primaryResult === 0 && settings.secondaryBy) {
      return compareTodosByCriteria(a, b, settings.secondaryBy, secondaryDirection);
    }
    
    return primaryResult;
  });
}

// Helper function to compare todos by a specific criteria
function compareTodosByCriteria(a, b, criteria, direction) {
  let compareA, compareB;
  
  switch (criteria) {
    case 'start_date':
      compareA = a.start_date || '9999-12-31'; // Tasks without start date go to end
      compareB = b.start_date || '9999-12-31';
      return compareA.localeCompare(compareB) * direction;
    
    case 'due_date':
      compareA = a.due_date || '9999-12-31'; // Tasks without due date go to end
      compareB = b.due_date || '9999-12-31';
      return compareA.localeCompare(compareB) * direction;
    
    case 'importance':
      compareA = a.importance || 4;
      compareB = b.importance || 4;
      return (compareA - compareB) * direction;
    
    case 'recurring':
      compareA = a.recurrence_rule ? 0 : 1; // Recurring tasks first
      compareB = b.recurrence_rule ? 0 : 1;
      return (compareA - compareB) * direction;
    
    case 'alphabetical':
      compareA = (a.text || '').toLowerCase();
      compareB = (b.text || '').toLowerCase();
      return compareA.localeCompare(compareB) * direction;
    
    default:
      return 0;
  }
}

// Render todos grouped by completion date (for archive)
function renderArchiveGrouped(filteredTodos, container) {
  const grouped = {};
  
  filteredTodos.forEach(todo => {
    const completedDate = todo.completed_at || todo.updated_at || '';
    const dateKey = completedDate.split('T')[0]; // Get YYYY-MM-DD
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(todo);
  });
  
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  
  let html = '';
  sortedDates.forEach(dateKey => {
    const displayDate = formatArchiveDate(dateKey);
    html += `<div class="archive-date-group">
      <h3 class="archive-date-header">${displayDate}</h3>
      <div class="archive-todos">`;
    
    // Sort todos within each date group
    const sortedTodos = sortTodos(grouped[dateKey]);
    sortedTodos.forEach(todo => {
      html += renderTodoItem(todo);
    });
    
    html += `</div></div>`;
  });
  
  // Add "Show All" button if not already showing all
  if (!showAllArchive) {
    html += `<div style="text-align: center; margin-top: 20px;">
      <button class="add-btn" onclick="toggleShowAllArchive()">Show All Archive</button>
    </div>`;
  } else {
    html += `<div style="text-align: center; margin-top: 20px;">
      <button class="add-btn" onclick="toggleShowAllArchive()">Show Last 10 Days Only</button>
    </div>`;
  }
  
  container.innerHTML = html;
}

// Render regular todo list
function renderTodoList(filteredTodos, container) {
  container.innerHTML = filteredTodos.map(todo => renderTodoItem(todo)).join('');
}

// Render a single todo item
function renderTodoItem(todo) {
  const importanceClass = `importance-${todo.importance || 4}`;
  const completedClass = todo.completed ? 'completed' : '';
  const importanceIcons = { 1: '🔴', 2: '🟠', 3: '🟡', 4: '⚪' };
  
  // Check if task is due today or overdue
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isDueToday = todo.due_date && todo.due_date === today && !todo.completed;
  const isOverdue = todo.due_date && todo.due_date < today && !todo.completed;
  const dueTodayClass = isDueToday ? 'due-today' : '';
  const overdueClass = isOverdue ? 'overdue' : '';
  
  let metaInfo = [];
  if (todo.start_date) metaInfo.push(`▶️ ${formatDate(todo.start_date)}`);
  if (todo.due_date) metaInfo.push(`📅 ${formatDate(todo.due_date)}`);
  if (todo.recurrence_rule) metaInfo.push('🔁 Recurring');
  
  const labelsHtml = (todo.labels && todo.labels.length > 0) 
    ? `<div class="todo-labels">${todo.labels.map(l => `<span class="todo-label">${escapeHtml(l)}</span>`).join('')}</div>`
    : '';
  
  const archiveBtn = currentView === 'archive'
    ? `<button class="todo-action-btn" onclick="unarchiveTodoItem(event, ${todo.id})">Unarchive</button>`
    : `<button class="todo-action-btn" onclick="archiveTodoItem(event, ${todo.id})">Archive</button>`;
  
  return `
    <div class="todo-item ${importanceClass} ${completedClass} ${dueTodayClass} ${overdueClass}" onclick="openTodoForm(${todo.id})">
      <input 
        type="checkbox" 
        class="todo-checkbox" 
        ${todo.completed ? 'checked' : ''}
        onclick="toggleTodoComplete(event, ${todo.id})"
      />
      <div class="todo-main-content">
        <div class="todo-text">${importanceIcons[todo.importance || 4]} ${escapeHtml(todo.text)}</div>
        ${todo.description ? `<div style="color: #999; font-size: 13px; margin-top: 4px;">${escapeHtml(todo.description)}</div>` : ''}
        ${metaInfo.length > 0 ? `<div class="todo-meta">${metaInfo.join(' • ')}</div>` : ''}
        ${labelsHtml}
      </div>
      <div class="todo-actions">
        ${archiveBtn}
        <button class="todo-action-btn delete" onclick="deleteTodoItem(event, ${todo.id})">Delete</button>
      </div>
    </div>
  `;
}

// Format archive date header
function formatArchiveDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';
  
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  
  if (year === currentYear) {
    return `${dayOfWeek}, ${monthDay}`;
  } else {
    return `${dayOfWeek}, ${monthDay}, ${year}`;
  }
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
  
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Override the calendar's initializeCalendar to call todo initialization instead
function initializeCalendar() {
  initializeTodoApp();
}
