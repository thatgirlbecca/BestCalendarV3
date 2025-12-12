let date = new Date();
let calendarEvents = []; // Store events for the current month view
let currentView = localStorage.getItem('calendar_view') || 'month'; // 'month' or 'week'

// Restore the last viewed date if available
const savedDate = localStorage.getItem('calendar_date');
if (savedDate) {
  date = new Date(savedDate);
}

// Format a time string ("HH:MM" or "HH:MM:SS") into a human-friendly label
function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  const hour = parseInt(parts[0], 10);
  const minute = (parts[1] || '00').slice(0,2);
  if (Number.isNaN(hour)) return '';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = ((hour + 11) % 12) + 1; // convert 0->12
  return `${h}:${minute} ${ampm}`;
}

// Escape HTML for safe insertion into attributes (simple helper)
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format recurrence pattern into human-readable text
function formatRecurrencePattern(event) {
  if (!event.recurrence_rule || event.recurrence_rule === 'NONE' || event.recurrence_rule === '') {
    return null;
  }
  
  const interval = event.recurrence_interval || 1;
  const rule = event.recurrence_rule;
  
  let pattern = '';
  
  switch (rule) {
    case 'DAILY':
      pattern = interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;
    case 'WEEKLY':
      pattern = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      break;
    case 'MONTHLY':
      pattern = interval === 1 ? 'Every month' : `Every ${interval} months`;
      break;
    case 'YEARLY':
      pattern = interval === 1 ? 'Every year' : `Every ${interval} years`;
      break;
    case 'CUSTOM_DAYS':
      if (event.recurrence_days) {
        try {
          const days = JSON.parse(event.recurrence_days);
          const dayNames = {
            'MON': 'Monday',
            'TUE': 'Tuesday',
            'WED': 'Wednesday',
            'THU': 'Thursday',
            'FRI': 'Friday',
            'SAT': 'Saturday',
            'SUN': 'Sunday'
          };
          const dayList = days.map(d => dayNames[d] || d).join(', ');
          pattern = interval === 1 ? `Every ${dayList}` : `Every ${interval} weeks on ${dayList}`;
        } catch (e) {
          pattern = 'Custom days';
        }
      } else {
        pattern = 'Custom days';
      }
      break;
    case 'MONTHLY_NTH':
      if (event.nth_week && event.nth_weekday) {
        const weekNames = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'last' };
        const dayNames = {
          'MON': 'Monday',
          'TUE': 'Tuesday',
          'WED': 'Wednesday',
          'THU': 'Thursday',
          'FRI': 'Friday',
          'SAT': 'Saturday',
          'SUN': 'Sunday'
        };
        const week = weekNames[event.nth_week] || event.nth_week;
        const day = dayNames[event.nth_weekday] || event.nth_weekday;
        pattern = interval === 1 
          ? `Every ${week} ${day} of the month` 
          : `Every ${interval} months on the ${week} ${day}`;
      } else {
        pattern = 'Monthly on specific weekday';
      }
      break;
    default:
      pattern = 'Repeating event';
  }
  
  // Add end date or count if present
  if (event.recurrence_end_date) {
    const endDate = new Date(event.recurrence_end_date);
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    pattern += ` (until ${endStr})`;
  } else if (event.recurrence_count) {
    pattern += ` (${event.recurrence_count} times)`;
  }
  
  return pattern;
}

// Expand recurring events into individual occurrences for the given date range
function expandRecurringEvents(events, startDate, endDate) {
  const expanded = [];
  // Parse dates in local time to avoid timezone shifts
  const startParts = startDate.split('-');
  const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
  const endParts = endDate.split('-');
  const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
  
  events.forEach(ev => {
    if (!ev.recurrence_rule || ev.recurrence_rule === '' || ev.recurrence_rule === 'NONE') {
      // Non-recurring event
      expanded.push(ev);
      return;
    }
    
    // Parse dates in local time to avoid timezone issues
    const evStartParts = ev.start_date.split('-');
    const evStart = new Date(parseInt(evStartParts[0]), parseInt(evStartParts[1]) - 1, parseInt(evStartParts[2]));
    const interval = ev.recurrence_interval || 1;
    let recEndDate = null;
    if (ev.recurrence_end_date) {
      const endParts = ev.recurrence_end_date.split('-');
      recEndDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    }
    const maxDate = recEndDate && recEndDate < end ? recEndDate : end;
    
    // Generate occurrences based on pattern
    let current = new Date(evStart);
    let count = 0;
    const maxCount = ev.recurrence_count || 365; // safety limit
    
    // For CUSTOM_DAYS, find occurrences within each week
    if (ev.recurrence_rule === 'CUSTOM_DAYS' && ev.recurrence_days) {
      // Map getDay() (0=Sun, 1=Mon, ..., 6=Sat) to day names
      const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
      const allowedDays = JSON.parse(ev.recurrence_days);
      
      // Start from beginning of the week containing evStart (Monday-based week)
      let weekStart = new Date(evStart);
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1); // If Sunday, go back 6 days; else go back to Monday
      weekStart.setDate(weekStart.getDate() + mondayOffset);
      
      while (weekStart <= maxDate && count < maxCount) {
        // Check each day in this week
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const checkDate = new Date(weekStart);
          checkDate.setDate(checkDate.getDate() + dayOffset);
          
          if (checkDate > maxDate) break;
          
          const dayName = dayNames[checkDate.getDay()];
          // Compare date strings to avoid timezone issues
          const checkDateStr = checkDate.toISOString().split('T')[0];
          const evStartStr = evStart.toISOString().split('T')[0];
          const startStr = start.toISOString().split('T')[0];
          const endStr = end.toISOString().split('T')[0];
          const inRange = checkDateStr >= startStr && checkDateStr >= evStartStr && checkDateStr <= endStr;
          
          // Check if this date is excluded
          const isExcluded = ev.excluded_dates && Array.isArray(ev.excluded_dates) && ev.excluded_dates.includes(checkDateStr);
          
          if (allowedDays.includes(dayName) && inRange && !isExcluded) {
            const occurrence = {
              ...ev,
              start_date: checkDateStr,
              end_date: checkDateStr,
              is_recurring_instance: true,
              original_event_id: ev.id
            };
            expanded.push(occurrence);
            count++;
          }
        }
        // Advance by interval weeks
        weekStart.setDate(weekStart.getDate() + (interval * 7));
      }
    } else if (ev.recurrence_rule === 'MONTHLY_NTH' && ev.nth_week && ev.nth_weekday) {
      // Handle nth weekday of month (e.g., 2nd Friday)
      const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
      const targetWeekdayIndex = dayNames.indexOf(ev.nth_weekday);
      const nthWeek = parseInt(ev.nth_week);
      
      let monthCursor = new Date(evStart.getFullYear(), evStart.getMonth(), 1);
      
      while (monthCursor <= maxDate && count < maxCount) {
        // Find the nth occurrence of the target weekday in this month
        const year = monthCursor.getFullYear();
        const month = monthCursor.getMonth();
        
        // Collect all occurrences of the target weekday in this month
        const occurrences = [];
        for (let day = 1; day <= 31; day++) {
          const testDate = new Date(year, month, day);
          if (testDate.getMonth() !== month) break; // Moved to next month
          if (testDate.getDay() === targetWeekdayIndex) {
            occurrences.push(new Date(testDate));
          }
        }
        
        // Select the nth occurrence (or last if nthWeek === -1)
        let targetDate = null;
        if (nthWeek === -1) {
          targetDate = occurrences[occurrences.length - 1];
        } else if (nthWeek > 0 && nthWeek <= occurrences.length) {
          targetDate = occurrences[nthWeek - 1];
        }
        
        if (targetDate) {
          const targetDateStr = targetDate.toISOString().split('T')[0];
          const startStr = start.toISOString().split('T')[0];
          const endStr = end.toISOString().split('T')[0];
          
          // Check if this date is excluded
          const isExcluded = ev.excluded_dates && Array.isArray(ev.excluded_dates) && ev.excluded_dates.includes(targetDateStr);
          
          if (targetDateStr >= startStr && targetDateStr <= endStr && targetDate >= evStart && !isExcluded) {
            const occurrence = {
              ...ev,
              start_date: targetDateStr,
              end_date: targetDateStr,
              is_recurring_instance: true,
              original_event_id: ev.id
            };
            expanded.push(occurrence);
            count++;
          }
        }
        
        // Advance by interval months
        monthCursor.setMonth(monthCursor.getMonth() + interval);
      }
    } else {
      // Handle DAILY, WEEKLY, MONTHLY, YEARLY
      while (current <= maxDate && count < maxCount) {
        const currentDateStr = current.toISOString().split('T')[0];
        const isExcluded = ev.excluded_dates && Array.isArray(ev.excluded_dates) && ev.excluded_dates.includes(currentDateStr);
        
        if (current >= start && current <= end && !isExcluded) {
          const occurrence = {
            ...ev,
            start_date: currentDateStr,
            end_date: currentDateStr,
            is_recurring_instance: true,
            original_event_id: ev.id
          };
          expanded.push(occurrence);
        }
        
        // Advance to next occurrence
        switch (ev.recurrence_rule) {
          case 'DAILY':
            current.setDate(current.getDate() + interval);
            break;
          case 'WEEKLY':
            current.setDate(current.getDate() + (interval * 7));
            break;
          case 'MONTHLY':
            current.setMonth(current.getMonth() + interval);
            break;
          case 'YEARLY':
            current.setFullYear(current.getFullYear() + interval);
            break;
          default:
            current = new Date(maxDate.getTime() + 86400000); // exit loop
        }
        count++;
      }
    }
  });
  
  return expanded;
}

async function renderWeekView() {
    const monthDays = document.getElementById('calendar-body');
    const weekViewContainer = document.getElementById('week-view-container');
    const timeline = document.getElementById('timeline');
    const monthHeader = document.getElementById('month');
    const weekdaysHeader = document.getElementById('weekdays-header');
    
    // Hide month view and original timeline, show week view container
    monthDays.style.display = 'none';
    weekViewContainer.style.display = 'flex';
    timeline.style.display = 'none';
    if (weekdaysHeader) weekdaysHeader.style.display = 'none';
    
    // Get the start of the current week (Monday)
    const today = new Date(date);
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    
    // Get the end of the week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Update header to show week range
    const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    monthHeader.textContent = `${weekStartStr} - ${weekEndStr}`;
    
    // Show/hide the "Today" button in week view
    const todayCheck = new Date();
    const todayWeekStart = new Date(todayCheck);
    const todayDay = todayWeekStart.getDay();
    const todayDiff = todayDay === 0 ? -6 : 1 - todayDay;
    todayWeekStart.setDate(todayWeekStart.getDate() + todayDiff);
    todayWeekStart.setHours(0, 0, 0, 0);
    
    const isViewingCurrentWeek = weekStart.getTime() === todayWeekStart.getTime();
    const todayButton = document.getElementById('today-button');
    if (todayButton) {
      todayButton.style.display = isViewingCurrentWeek ? 'none' : 'inline-block';
    }
    
    // Fetch events for the week
    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];
    const rawEvents = await getEvents(startStr, endStr);
    
    const expanded = expandRecurringEvents(rawEvents, startStr, endStr);
    calendarEvents = expanded || [];
    
    // First pass: calculate max all-day events across all days
    let maxAllDayEvents = 0;
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayEvents = calendarEvents.filter(e => {
          const evStart = e.start_date;
          const evEnd = e.end_date || e.start_date;
          return dateStr >= evStart && dateStr <= evEnd;
        });
        const allDayCount = dayEvents.filter(e => e.is_all_day).length;
        maxAllDayEvents = Math.max(maxAllDayEvents, allDayCount);
    }
    
    // Calculate uniform all-day section height (22px per event + 8px padding)
    const allDaySectionHeight = maxAllDayEvents > 0 ? (maxAllDayEvents * 22) + 8 : 30;
    
    // Calculate heights for alignment
    const headerHeight = 48; // Observed header height including padding and border (adjusted for alignment)
    const totalHeaderHeight = headerHeight + allDaySectionHeight;
    
    // Build unified grid with timeline and columns together
    const weekGrid = document.getElementById('week-grid');
    let gridHtml = '';
    
    // Add spacer to push timeline down below headers - make it match the combined header height
    gridHtml += `<div class="timeline-spacer" style="grid-row: 1; grid-column: 1; height: ${totalHeaderHeight}px; min-height: ${totalHeaderHeight}px;"></div>`;
    
    // Add timeline hours to grid (column 1), starting from row 2
    for (let hour = 0; hour <= 24; hour++) {
        const displayHour = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : hour === 24 ? '12am' : `${hour - 12}pm`;
        gridHtml += `<div class="timeline-hour" style="grid-row: ${hour + 2}; grid-column: 1;">${displayHour}</div>`;
    }
    
    // Add horizontal row dividers (span all columns), starting from row 2
    for (let row = 2; row <= 26; row++) {
        gridHtml += `<div class="week-grid-row" style="grid-row: ${row}; grid-column: 1 / -1;"></div>`;
    }
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = currentDate.getDate();
        
        // Check if it's today
        const todayCheck = new Date();
        const isToday = currentDate.getDate() === todayCheck.getDate() &&
                       currentDate.getMonth() === todayCheck.getMonth() &&
                       currentDate.getFullYear() === todayCheck.getFullYear();
        
        // Filter events for this day - includes multi-day events that span this date
        const dayEvents = calendarEvents.filter(e => {
          const evStart = e.start_date;
          const evEnd = e.end_date || e.start_date;
          return dateStr >= evStart && dateStr <= evEnd;
        });
        
        // Separate all-day and timed events, considering multi-day logic
        const processedEvents = dayEvents.map(e => {
          const evStart = e.start_date;
          const evEnd = e.end_date || e.start_date;
          const isMultiDay = evStart !== evEnd;
          const isFirstDay = dateStr === evStart;
          const isLastDay = dateStr === evEnd;
          
          // For multi-day events: middle days become all-day
          let effectiveIsAllDay = e.is_all_day;
          let effectiveStartTime = e.start_time;
          let effectiveEndTime = e.end_time;
          
          if (isMultiDay && !isFirstDay && !isLastDay) {
            // Middle day of multi-day event: treat as all-day
            effectiveIsAllDay = true;
            effectiveStartTime = null;
            effectiveEndTime = null;
          } else if (isMultiDay && isFirstDay) {
            // First day: keep start time, ignore end time
            effectiveEndTime = null;
          } else if (isMultiDay && isLastDay) {
            // Last day: start at midnight, use end time
            effectiveStartTime = '00:00';
          }
          
          return { ...e, effectiveIsAllDay, effectiveStartTime, effectiveEndTime };
        });
        
        const allDayEvents = processedEvents.filter(e => e.effectiveIsAllDay);
        const timedEvents = processedEvents.filter(e => !e.effectiveIsAllDay);
        
        // Sort timed events by start time so earlier events get lower z-index
        timedEvents.sort((a, b) => {
            const timeA = a.effectiveStartTime || '00:00';
            const timeB = b.effectiveStartTime || '00:00';
            return timeA.localeCompare(timeB);
        });
        
        // Build all-day events HTML
        let allDayHtml = '';
        allDayEvents.forEach((evt, idx) => {
            const titleEsc = escapeHtml(evt.title || 'Untitled');
            const bgColor = evt.color || '#ffbbcf';
            allDayHtml += `
                <div class="week-allday-event" 
                     data-event-id="${evt.id}" 
                     data-day="${evt.start_date}"
                     data-event-idx="${idx}"
                     style="background-color: ${bgColor}; cursor: pointer;"
                     title="Click to view details">
                    <span class="event-title">${titleEsc}</span>
                </div>
            `;
        });
        
        // Build timed event HTML with time-based positioning
        let eventsHtml = '';
        
        // First, calculate positions for all events to detect overlaps
        const eventPositions = timedEvents.map((evt) => {
            let top = 0;
            let height = 50;
            
            if (evt.effectiveStartTime) {
                const [startHour, startMin] = evt.effectiveStartTime.split(':').map(Number);
                top = (startHour * 50) + (startMin * 50 / 60);
                
                if (evt.effectiveEndTime) {
                    const [endHour, endMin] = evt.effectiveEndTime.split(':').map(Number);
                    const endMinutes = (endHour * 60) + endMin;
                    const startMinutes = (startHour * 60) + startMin;
                    const durationMinutes = endMinutes - startMinutes;
                    height = Math.max((durationMinutes * 50 / 60), 20);
                } else {
                    height = 50;
                }
            }
            
            return { top, height, bottom: top + height };
        });
        
        timedEvents.forEach((evt, idx) => {
            const titleEsc = escapeHtml(evt.title || 'Untitled');
            const bgColor = evt.color || '#ffbbcf';
            
            const { top, height } = eventPositions[idx];
            
            // Check for overlaps with earlier events
            let rightOffset = 4; // Default right padding
            for (let i = 0; i < idx; i++) {
                const earlier = eventPositions[i];
                // Check if this event overlaps with the earlier event
                if (top < earlier.bottom && (top + height) > earlier.top) {
                    // Overlap detected - indent this event
                    rightOffset = 10; // Leave more space to see the earlier event
                    break;
                }
            }
            
            const timeLabel = evt.effectiveStartTime && evt.effectiveEndTime 
                ? `${formatTime(evt.effectiveStartTime)}<span class="event-end-time"> - ${formatTime(evt.effectiveEndTime)}</span>` 
                : evt.effectiveStartTime 
                ? formatTime(evt.effectiveStartTime) 
                : '';
            
            eventsHtml += `
                <div class="week-event" 
                     data-event-id="${evt.id}" 
                     data-day="${evt.start_date}"
                     data-event-idx="${idx}"
                     style="top: ${top}px; height: ${height}px; right: ${rightOffset}px; z-index: ${10 + idx}; background-color: ${bgColor}; cursor: pointer;"
                     title="Click to view details">
                    ${timeLabel ? `<span class="event-time">${timeLabel}</span> ` : ''}
                    <span class="event-title">${titleEsc}</span>
                </div>
            `;
        });
        
        // Add header and all-day section wrapper as grid item at row 1
        gridHtml += `
            <div class="week-day-header-wrapper" style="grid-row: 1; grid-column: ${i + 2};">
                <div class="week-day-header">
                    <div class="day-name">${dayName}</div>
                    <div class="day-number${isToday ? ' today' : ''}">${dayNum}</div>
                </div>
                <div class="week-allday-section" style="height: ${allDaySectionHeight}px; min-height: ${allDaySectionHeight}px; max-height: ${allDaySectionHeight}px;">
                    ${allDayHtml}
                </div>
            </div>
        `;
        
        gridHtml += `
            <div class="week-day-column${isToday ? ' today' : ''}" data-date="${dateStr}" style="grid-row: 2 / 27; grid-column: ${i + 2};">
                ${eventsHtml}
            </div>
        `;
    }
    
    weekGrid.innerHTML = gridHtml;
    
    // No need to sync timeline anymore - it's in the same grid
    
    // Auto-scroll to 6am (6 hours * 50px = 300px)
    setTimeout(() => {
        weekGrid.scrollTop = 300;
    }, 0);
    
    // Save current date to localStorage
    localStorage.setItem('calendar_date', date.toISOString());
    
    // Attach click handlers to all event items after rendering
    attachEventItemListeners();
    
    // Attach click handlers to day cells for creating new events
    attachDayCellListeners();
}

async function renderCalendar() {
    if (currentView === 'week') {
        await renderWeekView();
        return;
    }
    
    date.setDate(1);

    const monthDays = document.getElementById('calendar-body');
    const weekViewContainer = document.getElementById('week-view-container');
    const month = document.getElementById('month');
    const weekdaysHeader = document.getElementById('weekdays-header');
    
    // Show month view, hide week view container
    monthDays.style.display = 'grid';
    weekViewContainer.style.display = 'none';
    
    // Remove week-view class and show weekdays header for month view
    monthDays.classList.remove('week-view');
    if (weekdaysHeader) weekdaysHeader.style.display = 'grid';

    const lastDay = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
    ).getDate();

    const prevLastDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        0
    ).getDate();

    // Shift day indices so Monday is 0, Tuesday 1, ... Sunday 6
    const firstDayIndex = (date.getDay() + 6) % 7;

    const lastDayIndex = (new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDay() + 6) % 7;

    const nextDays = 7 - lastDayIndex - 1;

    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];
    
    month.innerText = `${months[date.getMonth()]} ${date.getFullYear()}`;

    // Show/hide the "Today" button: only show if not currently viewing today's month/year
    const today = new Date();
    const todayButton = document.getElementById('today-button');
    if (todayButton) {
      if (currentView === 'week') {
        // In week view, show if not viewing current week
        const weekStart = new Date(date);
        const currentDay = weekStart.getDay();
        const diff = currentDay === 0 ? -6 : 1 - currentDay;
        weekStart.setDate(weekStart.getDate() + diff);
        weekStart.setHours(0, 0, 0, 0);
        
        const todayWeekStart = new Date(today);
        const todayDay = todayWeekStart.getDay();
        const todayDiff = todayDay === 0 ? -6 : 1 - todayDay;
        todayWeekStart.setDate(todayWeekStart.getDate() + todayDiff);
        todayWeekStart.setHours(0, 0, 0, 0);
        
        const isViewingCurrentWeek = weekStart.getTime() === todayWeekStart.getTime();
        todayButton.style.display = isViewingCurrentWeek ? 'none' : 'inline-block';
      } else {
        // In month view, show if not viewing today's month/year
        const isViewingToday = (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear());
        todayButton.style.display = isViewingToday ? 'none' : 'inline-block';
      }
    }

    // Load events for this month
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const rawEvents = await getEvents(
        firstDay.toISOString().split('T')[0],
        lastDayOfMonth.toISOString().split('T')[0]
    );
    
    // Expand recurring events into individual occurrences
    calendarEvents = expandRecurringEvents(
        rawEvents,
        firstDay.toISOString().split('T')[0],
        lastDayOfMonth.toISOString().split('T')[0]
    );

    let days = '';

    for (let x = firstDayIndex; x > 0; x--) {
        // keep the cell but don't show the previous month's number
        days += `<div class='prev-date'></div>`;
    }

    for (let i = 1; i <= lastDay; i++) {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Get events for this specific day - includes multi-day events that span this date
        const dayEvents = calendarEvents.filter(ev => {
          const evStart = ev.start_date;
          const evEnd = ev.end_date || ev.start_date;
          return dateStr >= evStart && dateStr <= evEnd;
        }).sort((a, b) => {
            // All-day events first
            if (a.is_all_day && !b.is_all_day) return -1;
            if (!a.is_all_day && b.is_all_day) return 1;
            // Then sort by start_time
            const timeA = a.start_time || '00:00';
            const timeB = b.start_time || '00:00';
            return timeA.localeCompare(timeB);
          });
        const eventsHtml = dayEvents.map((ev, idx) => {
          const evStart = ev.start_date;
          const evEnd = ev.end_date || ev.start_date;
          const isMultiDay = evStart !== evEnd;
          const isFirstDay = dateStr === evStart;
          const isLastDay = dateStr === evEnd;
          
          // For multi-day events: only show start time on first day, end time on last day
          let isAllDay = !!ev.is_all_day;
          let timeLabel = '';
          
          if (isMultiDay) {
            // Multi-day event
            if (isFirstDay && ev.start_time) {
              // First day: show start time
              timeLabel = formatTime(ev.start_time);
            } else if (isLastDay && ev.end_time) {
              // Last day: show end time
              timeLabel = formatTime(ev.end_time);
            } else {
              // Middle days: treat as all-day
              isAllDay = true;
            }
          } else {
            // Single day event: use original logic
            if (!isAllDay && ev.start_time) {
              timeLabel = formatTime(ev.start_time);
            }
          }
          
          const classNames = ['event-item'];
          if (isAllDay) classNames.push('all-day-event');
          const bgColor = ev.color || ev.event_color || '#ffbbcf';
          const timeHtml = timeLabel ? `<span class="event-time">${timeLabel}</span>` : '';
          const titleText = ev.title || '';
          const titleHtml = `<span class="event-title">${titleText}</span>`;
          // Store event data in data attributes for click handler
          const eventDataAttr = `data-event-id="${ev.id}" data-day="${dateStr}" data-event-idx="${idx}"`;
          return `<div class='${classNames.join(' ')}' ${eventDataAttr} style='cursor:pointer; background-color:${bgColor};' title="Click to view details">${timeHtml}${titleHtml}</div>`;
        }).join('');
        
        // Only mark as "today" when the rendered month AND year match today's month and year
        const realToday = new Date();
        if (
            i === realToday.getDate() &&
            date.getMonth() === realToday.getMonth() &&
            date.getFullYear() === realToday.getFullYear()
        ) {
            days += `<div class='day-cell today'><span class='day-number'>${i}</span>${eventsHtml}</div>`;
        } else {
            days += `<div class='day-cell'><span class='day-number'>${i}</span>${eventsHtml}</div>`;
        }
    }

    for (let j = 1; j <= nextDays; j++) {
        // keep the cell but leave it blank instead of showing next month's numbers
        days += `<div class='next-date'></div>`;
    }

    monthDays.innerHTML = days;
    
    // Save current date to localStorage
    localStorage.setItem('calendar_date', date.toISOString());
    
    // Attach click handlers to all event items after rendering
    attachEventItemListeners();
    
    // Attach click handlers to day cells for creating new events
    attachDayCellListeners();
    
    // Adjust grid row heights so the full month fits in the viewport
    adjustGridRowHeights();
}

// Calculate and set grid row heights so the entire month grid fits in the window
function adjustGridRowHeights() {
  // Skip in week view
  if (currentView === 'week') return;
  
  const monthDays = document.getElementById('calendar-body');
  const header = document.getElementById('calendar-header');
  const weekdays = document.getElementById('weekdays-header');
  if (!monthDays || !header || !weekdays) return;

  // Count total cells (day-cell, prev-date, next-date) and compute weeks
  const cells = monthDays.querySelectorAll('.day-cell, .prev-date, .next-date');
  const total = cells.length || 42;
  const weeks = Math.ceil(total / 7) || 6;

  // Get gap size between grid rows/columns (in px)
  const style = getComputedStyle(monthDays);
  const gap = parseFloat(style.getPropertyValue('gap')) || 1;

  // Measure available space
  const headerH = header.getBoundingClientRect().height;
  const weekdaysH = weekdays.getBoundingClientRect().height;
  const availableHeight = Math.max(80, window.innerHeight - headerH - weekdaysH - 12);

  // Compute cell width from available width (fill horizontally) and row height
  const containerWidth = monthDays.clientWidth;
  const totalGapWidth = gap * (7 - 1);
  const availableWidthForCells = Math.max(0, containerWidth - totalGapWidth);
  const cellWidth = Math.max(40, Math.floor(availableWidthForCells / 7));

  // Compute row height so all weeks fit into available height
  const totalGapHeight = gap * (weeks - 1);
  const rowHeight = Math.max(24, Math.floor((availableHeight - totalGapHeight) / weeks));

  // Apply pixel-based columns so cells align wall-to-wall, and rows sized to fit vertically
  monthDays.style.gridTemplateColumns = `repeat(7, ${cellWidth}px)`;
  weekdays.style.gridTemplateColumns = `repeat(7, ${cellWidth}px)`;
  monthDays.style.gridAutoRows = `${rowHeight}px`;
  monthDays.style.overflow = 'hidden';
}

// Recalculate on window resize (debounced lightly)
let _resizeTimer = null;
window.addEventListener('resize', () => {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    adjustGridRowHeights();
  }, 120);
});

// Attach click handlers to event items
function attachEventItemListeners() {
  // Handle both month view (.event-item) and week view (.week-event, .week-allday-event) events
  // Exclude elements inside modals to prevent interfering with form controls
  document.querySelectorAll('#calendar-body .event-item, #week-grid .week-event, #week-grid .week-allday-event').forEach(item => {
    // Remove any existing click handlers by cloning and replacing
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    
    newItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = newItem.getAttribute('data-event-id');
      const dayStr = newItem.getAttribute('data-day');
      const eventIdx = newItem.getAttribute('data-event-idx');
      showEventModal(eventId, dayStr, eventIdx);
    });
  });
}

// Attach click handlers to day cells for creating new events
function attachDayCellListeners() {
  document.querySelectorAll('.day-cell, .prev-date, .next-date').forEach(cell => {
    cell.addEventListener('click', (e) => {
      // Only open form if clicking on the cell itself, not on an event item
      if (e.target.closest('.event-item')) {
        return;
      }
      
      // Skip if clicking on non-day cells (prev-date/next-date without actual date data)
      if (cell.classList.contains('prev-date') || cell.classList.contains('next-date')) {
        return;
      }
      
      // Extract the date from the day cell
      // Find the date by looking at the cell position and calculating the date
      const cells = document.querySelectorAll('.day-cell, .prev-date, .next-date');
      const cellIndex = Array.from(cells).indexOf(cell);
      
      // Calculate the date based on cell index
      const firstDayIndex = (date.getDay() + 6) % 7;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      
      // Days from previous month come first
      const prevLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
      const prevMonthDays = firstDayIndex;
      
      // Calculate which day this cell represents
      let dayNum = cellIndex - prevMonthDays + 1;
      let targetDate = new Date(date.getFullYear(), date.getMonth(), dayNum);
      
      // If dayNum is negative or zero, it's in the previous month
      if (dayNum <= 0) {
        targetDate = new Date(date.getFullYear(), date.getMonth() - 1, prevLastDay + dayNum);
      }
      
      // If dayNum is greater than lastDay, it's in the next month
      if (dayNum > lastDay) {
        targetDate = new Date(date.getFullYear(), date.getMonth() + 1, dayNum - lastDay);
      }
      
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Pre-fill the form with the selected date and open it
      openFormWithDate(dateStr);
    });
  });
}

// Show event details modal when an event is clicked
function showEventModal(eventId, dayStr, eventIdx) {
  const dayEvents = calendarEvents.filter(ev => ev.start_date === dayStr);
  
  // Find event by ID first (most reliable), then fallback to index
  let event = eventId ? dayEvents.find(e => String(e.id) === String(eventId)) : null;
  if (!event && eventIdx !== undefined && eventIdx !== null) {
    // Sort the same way as week view for consistent indexing
    const sortedEvents = [...dayEvents].sort((a, b) => {
      // All-day events first
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      // Then sort by start_time
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
    event = sortedEvents[eventIdx];
  }
  
  if (!event) {
    console.error('Event not found:', { eventId, dayStr, eventIdx, dayEvents });
    return;
  }

  const modal = document.getElementById('event-detail-modal');
  const timeLabel = formatTime(event.start_time) || 'No time set';
  
  // Parse date string to avoid timezone issues
  const [year, month, day] = dayStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // month is 0-indexed
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Determine if this is a recurring event instance
  const isRecurringInstance = event.is_recurring_instance || (event.recurrence_rule && event.recurrence_rule !== 'NONE' && event.recurrence_rule !== '');
  const deleteHandler = isRecurringInstance 
    ? `handleRecurringEventDelete('${escapeHtml(String(event.original_event_id || event.id))}', '${dayStr}')`
    : `deleteEventFromModal('${escapeHtml(String(event.id))}')`;
  
  // Get recurrence pattern text if this is a recurring event
  let recurrencePattern = null;
  try {
    recurrencePattern = formatRecurrencePattern(event);
  } catch (e) {
    console.error('Error formatting recurrence pattern:', e);
  }
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">${escapeHtml(event.title || 'Event')}</h2>
        <div>
          <button class="modal-delete" onclick="${deleteHandler}">🗑</button>
          <button class="modal-duplicate" onclick="duplicateEvent('${escapeHtml(String(event.id))}','${dayStr}','${eventIdx}')">🗍</button>
          <button class="modal-edit" onclick="startEditEvent('${escapeHtml(String(event.id))}','${dayStr}','${eventIdx}')">✎</button>
          <button class="modal-close" onclick="closeEventModal()">&times;</button>
        </div>
      </div>
      <div class="modal-field">
        <div class="modal-field-label">Date</div>
        <div class="modal-field-value">${dateStr}</div>
      </div>
      <div class="modal-field modal-time-row">
        <div class="modal-time-field">
          <div class="modal-field-label">Start Time</div>
          <div class="modal-field-value">${timeLabel}</div>
        </div>
        ${event.end_time ? `
        <span class="modal-time-separator">-</span>
        <div class="modal-time-field">
          <div class="modal-field-label">End Time</div>
          <div class="modal-field-value">${formatTime(event.end_time)}</div>
        </div>
        ` : ''}
      </div>
      ${recurrencePattern ? `
      <div class="modal-field">
        <div class="modal-field-label">Repeats</div>
        <div class="modal-field-value">🔁 ${escapeHtml(recurrencePattern)}</div>
      </div>
      ` : ''}
      ${event.location ? `
      <div class="modal-field">
        <div class="modal-field-label">Location</div>
        <div class="modal-field-value">${escapeHtml(event.location)}</div>
      </div>
      ` : ''}
      ${event.description ? `
      <div class="modal-field">
        <div class="modal-field-label">Description</div>
        <div class="modal-field-value">${escapeHtml(event.description)}</div>
      </div>
      ` : ''}
    </div>
  `;

  modal.classList.add('show');
}

// Open the form pre-filled to edit an event
function startEditEvent(eventId, dayStr, eventIdx) {
  // Find the event in the loaded events for the month
  const ev = calendarEvents.find(e => String(e.id) === String(eventId) && e.start_date === dayStr) || calendarEvents.find(e => String(e.id) === String(eventId));
  if (!ev) {
    alert('Event not found for editing');
    return;
  }

  // Populate form fields
  document.getElementById('event-title').value = ev.title || '';
  document.getElementById('event-date').value = ev.start_date || '';
  document.getElementById('event-end-date').value = ev.end_date || ev.start_date || '';
  document.getElementById('event-time').value = ev.start_time ? (ev.start_time.slice(0,5)) : '';
  document.getElementById('event-description').value = ev.description || '';
  document.getElementById('event-location').value = ev.location || '';
  document.getElementById('editing-event-id').value = ev.id;
  const colorInput = document.getElementById('event-color');
  const colorPreview = document.getElementById('color-preview');
  const colorValue = ev.color || ev.event_color || '';
  if (colorInput) colorInput.value = colorValue;
  if (colorPreview) colorPreview.textContent = colorValue ? colorValue : 'Default';

  // Handle all-day flag
  const allDayCheckbox = document.getElementById('all-day-event');
  const eventTimeInput = document.getElementById('event-time');
  if (allDayCheckbox) {
    allDayCheckbox.checked = ev.is_all_day || false;
    if (eventTimeInput) {
      if (ev.is_all_day) {
        eventTimeInput.disabled = true;
        eventTimeInput.style.opacity = '0.5';
        eventTimeInput.style.cursor = 'not-allowed';
      } else {
        eventTimeInput.disabled = false;
        eventTimeInput.style.opacity = '1';
        eventTimeInput.style.cursor = 'auto';
      }
    }
  }

  // Handle end_time if it exists
  const addEndTimeCheckbox = document.getElementById('add-end-time');
  const endTimeContainer = document.getElementById('end-time-container');
  const endTimeInput = document.getElementById('event-end-time');
  if (ev.end_time) {
    if (addEndTimeCheckbox) addEndTimeCheckbox.checked = true;
    if (endTimeContainer) endTimeContainer.style.display = 'block';
    if (endTimeInput) endTimeInput.value = ev.end_time.slice(0, 5);
  } else {
    if (addEndTimeCheckbox) addEndTimeCheckbox.checked = false;
    if (endTimeContainer) endTimeContainer.style.display = 'none';
    if (endTimeInput) endTimeInput.value = '';
  }

  // Handle recurrence fields
  const repeatCheckbox = document.getElementById('repeat-event');
  const recurrenceContainer = document.getElementById('recurrence-container');
  const recurrencePattern = document.getElementById('recurrence-pattern');
  const recurrenceInterval = document.getElementById('recurrence-interval');
  const recurrenceEndDate = document.getElementById('recurrence-end-date');
  const customDaysContainer = document.getElementById('custom-days-container');
  
  if (ev.recurrence_rule && ev.recurrence_rule !== '' && ev.recurrence_rule !== 'NONE') {
    if (repeatCheckbox) repeatCheckbox.checked = true;
    if (recurrenceContainer) recurrenceContainer.style.display = 'block';
    if (recurrencePattern) recurrencePattern.value = ev.recurrence_rule;
    if (recurrenceInterval) recurrenceInterval.value = ev.recurrence_interval || 1;
    
    // Set end type
    if (ev.recurrence_count) {
      const countRadio = document.querySelector('input[name="recurrence-end-type"][value="count"]');
      if (countRadio) countRadio.checked = true;
      const countInput = document.getElementById('recurrence-count');
      if (countInput) countInput.value = ev.recurrence_count;
    } else if (ev.recurrence_end_date) {
      const dateRadio = document.querySelector('input[name="recurrence-end-type"][value="date"]');
      if (dateRadio) dateRadio.checked = true;
      if (recurrenceEndDate) recurrenceEndDate.value = ev.recurrence_end_date;
    } else {
      const noneRadio = document.querySelector('input[name="recurrence-end-type"][value="none"]');
      if (noneRadio) noneRadio.checked = true;
    }
    
    if (ev.recurrence_rule === 'CUSTOM_DAYS' && ev.recurrence_days) {
      if (customDaysContainer) customDaysContainer.style.display = 'block';
      const selectedDays = JSON.parse(ev.recurrence_days);
      document.querySelectorAll('.day-checkbox').forEach(cb => {
        cb.checked = selectedDays.includes(cb.value);
      });
    }
    
    if (ev.recurrence_rule === 'MONTHLY_NTH') {
      const nthWeekdayContainer = document.getElementById('nth-weekday-container');
      if (nthWeekdayContainer) nthWeekdayContainer.style.display = 'block';
      const nthWeekSelect = document.getElementById('nth-week');
      const nthWeekdaySelect = document.getElementById('nth-weekday');
      if (nthWeekSelect && ev.nth_week) nthWeekSelect.value = ev.nth_week;
      if (nthWeekdaySelect && ev.nth_weekday) nthWeekdaySelect.value = ev.nth_weekday;
    }
  } else {
    if (repeatCheckbox) repeatCheckbox.checked = false;
    if (recurrenceContainer) recurrenceContainer.style.display = 'none';
  }

  // Change submit button label
  const submitBtn = document.getElementById('event-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Save';

  // Show the delete button when editing
  const deleteBtn = document.getElementById('delete-event-btn');
  if (deleteBtn) deleteBtn.style.display = 'inline-block';

  // Show the form and close modal (without clearing fields)
  document.getElementById("myForm").style.display = "block";
  closeEventModal();
}

function closeEventModal() {
  const modal = document.getElementById('event-detail-modal');
  modal.classList.remove('show');
}

// Duplicate an event (opens form pre-filled but without a date or editing-id)
function duplicateEvent(eventId, dayStr, eventIdx) {
  // Find the event
  const ev = calendarEvents.find(e => String(e.id) === String(eventId) && e.start_date === dayStr) || calendarEvents.find(e => String(e.id) === String(eventId));
  if (!ev) {
    alert('Event not found for duplication');
    return;
  }

  // Pre-fill form fields (same as startEditEvent but clear date and editing ID)
  document.getElementById('event-title').value = ev.title || '';
  document.getElementById('event-date').value = ''; // Clear date so user picks a new one
  document.getElementById('event-end-date').value = ''; // Clear end date too
  document.getElementById('event-time').value = ev.start_time ? (ev.start_time.slice(0,5)) : '';
  document.getElementById('event-description').value = ev.description || '';
  document.getElementById('event-location').value = ev.location || '';
  document.getElementById('editing-event-id').value = ''; // Clear so it creates a new event
  
  const colorInput = document.getElementById('event-color');
  const colorPreview = document.getElementById('color-preview');
  const colorValue = ev.color || ev.event_color || '';
  if (colorInput) colorInput.value = colorValue;
  if (colorPreview) colorPreview.textContent = colorValue ? colorValue : 'Default';

  // Handle all-day flag
  const allDayCheckbox = document.getElementById('all-day-event');
  const eventTimeInput = document.getElementById('event-time');
  if (allDayCheckbox) {
    allDayCheckbox.checked = ev.is_all_day || false;
    if (eventTimeInput) {
      if (ev.is_all_day) {
        eventTimeInput.disabled = true;
        eventTimeInput.style.opacity = '0.5';
        eventTimeInput.style.cursor = 'not-allowed';
      } else {
        eventTimeInput.disabled = false;
        eventTimeInput.style.opacity = '1';
        eventTimeInput.style.cursor = 'auto';
      }
    }
  }

  // Handle end_time
  const addEndTimeCheckbox = document.getElementById('add-end-time');
  const endTimeContainer = document.getElementById('end-time-container');
  const endTimeInput = document.getElementById('event-end-time');
  if (ev.end_time) {
    if (addEndTimeCheckbox) addEndTimeCheckbox.checked = true;
    if (endTimeContainer) endTimeContainer.style.display = 'block';
    if (endTimeInput) endTimeInput.value = ev.end_time.slice(0, 5);
  } else {
    if (addEndTimeCheckbox) addEndTimeCheckbox.checked = false;
    if (endTimeContainer) endTimeContainer.style.display = 'none';
    if (endTimeInput) endTimeInput.value = '';
  }

  // Handle recurrence fields (copy from original)
  const repeatCheckbox = document.getElementById('repeat-event');
  const recurrenceContainer = document.getElementById('recurrence-container');
  const recurrencePattern = document.getElementById('recurrence-pattern');
  const recurrenceInterval = document.getElementById('recurrence-interval');
  const recurrenceEndDate = document.getElementById('recurrence-end-date');
  const customDaysContainer = document.getElementById('custom-days-container');
  
  if (ev.recurrence_rule && ev.recurrence_rule !== '' && ev.recurrence_rule !== 'NONE') {
    if (repeatCheckbox) repeatCheckbox.checked = true;
    if (recurrenceContainer) recurrenceContainer.style.display = 'block';
    if (recurrencePattern) recurrencePattern.value = ev.recurrence_rule;
    if (recurrenceInterval) recurrenceInterval.value = ev.recurrence_interval || 1;
    
    // Set end type
    if (ev.recurrence_count) {
      const countRadio = document.querySelector('input[name="recurrence-end-type"][value="count"]');
      if (countRadio) countRadio.checked = true;
      const countInput = document.getElementById('recurrence-count');
      if (countInput) countInput.value = ev.recurrence_count;
    } else if (ev.recurrence_end_date) {
      const dateRadio = document.querySelector('input[name="recurrence-end-type"][value="date"]');
      if (dateRadio) dateRadio.checked = true;
      if (recurrenceEndDate) recurrenceEndDate.value = ev.recurrence_end_date;
    } else {
      const noneRadio = document.querySelector('input[name="recurrence-end-type"][value="none"]');
      if (noneRadio) noneRadio.checked = true;
    }
    
    if (ev.recurrence_rule === 'CUSTOM_DAYS' && ev.recurrence_days) {
      if (customDaysContainer) customDaysContainer.style.display = 'block';
      const selectedDays = JSON.parse(ev.recurrence_days);
      document.querySelectorAll('.day-checkbox').forEach(cb => {
        cb.checked = selectedDays.includes(cb.value);
      });
    }
    
    if (ev.recurrence_rule === 'MONTHLY_NTH') {
      const nthWeekdayContainer = document.getElementById('nth-weekday-container');
      if (nthWeekdayContainer) nthWeekdayContainer.style.display = 'block';
      const nthWeekSelect = document.getElementById('nth-week');
      const nthWeekdaySelect = document.getElementById('nth-weekday');
      if (nthWeekSelect && ev.nth_week) nthWeekSelect.value = ev.nth_week;
      if (nthWeekdaySelect && ev.nth_weekday) nthWeekdaySelect.value = ev.nth_weekday;
    }
  } else {
    if (repeatCheckbox) repeatCheckbox.checked = false;
    if (recurrenceContainer) recurrenceContainer.style.display = 'none';
  }

  // Set button to "Add Event" (not "Save")
  const submitBtn = document.getElementById('event-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Add Event';

  // Hide delete button (this is a new event)
  const deleteBtn = document.getElementById('delete-event-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // Show the form and close modal
  document.getElementById("myForm").style.display = "block";
  closeEventModal();
}

// Delete an event from the modal
async function deleteEventFromModal(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) {
    return;
  }

  try {
    const success = await deleteEvent(eventId);
    if (success) {
      closeEventModal();
      await renderCalendar();
    } else {
      alert('Failed to delete event. See console for details.');
    }
  } catch (err) {
    console.error('Error deleting event:', err);
    alert('Error deleting event. See console.');
  }
}

// Handle deletion of a recurring event instance
let pendingRecurringDelete = null;

async function handleRecurringEventDelete(eventId, occurrenceDate) {
  // Store the pending delete info
  pendingRecurringDelete = { eventId, occurrenceDate };
  
  // Show the custom dialog
  document.getElementById('recurring-delete-dialog').style.display = 'flex';
}

// User chose to delete only this occurrence
async function confirmDeleteSingleOccurrence() {
  if (!pendingRecurringDelete) return;
  
  const { eventId, occurrenceDate } = pendingRecurringDelete;
  document.getElementById('recurring-delete-dialog').style.display = 'none';
  
  try {
    const success = await addRecurringEventException(eventId, occurrenceDate);
    if (success) {
      closeEventModal();
      await renderCalendar();
    } else {
      alert('Failed to delete this occurrence. See console for details.');
    }
  } catch (err) {
    console.error('Error deleting occurrence:', err);
    alert('Error deleting occurrence. See console.');
  } finally {
    pendingRecurringDelete = null;
  }
}

// User chose to delete all occurrences
async function confirmDeleteAllOccurrences() {
  if (!pendingRecurringDelete) return;
  
  const { eventId } = pendingRecurringDelete;
  document.getElementById('recurring-delete-dialog').style.display = 'none';
  
  try {
    const success = await deleteEvent(eventId);
    if (success) {
      closeEventModal();
      await renderCalendar();
    } else {
      alert('Failed to delete event series. See console for details.');
    }
  } catch (err) {
    console.error('Error deleting event series:', err);
    alert('Error deleting event series. See console.');
  } finally {
    pendingRecurringDelete = null;
  }
}

// User cancelled the delete
function cancelRecurringDelete() {
  document.getElementById('recurring-delete-dialog').style.display = 'none';
  pendingRecurringDelete = null;
}

// Delete an event from the form (when editing)
async function deleteEventFromForm() {
  const editingId = document.getElementById('editing-event-id')?.value;
  if (!editingId) {
    alert('No event to delete.');
    return;
  }

  if (!confirm('Are you sure you want to delete this event?')) {
    return;
  }

  try {
    const success = await deleteEvent(editingId);
    if (success) {
      closeForm();
      await renderCalendar();
    } else {
      alert('Failed to delete event. See console for details.');
    }
  } catch (err) {
    console.error('Error deleting event:', err);
    alert('Error deleting event. See console.');
  }
}

document.getElementById('month-prev').addEventListener('click', () => {
    document.getElementById('calendar-body').classList.add('fade-out');
    setTimeout(() => {
        if (currentView === 'week') {
            date.setDate(date.getDate() - 7);
        } else {
            date.setMonth(date.getMonth() - 1);
        }
        renderCalendar();
        document.getElementById('calendar-body').classList.remove('fade-out');
    }, 500);
});

document.getElementById('month-next').addEventListener('click', () => {
    document.getElementById('calendar-body').classList.add('fade-out');
    setTimeout(() => {
        if (currentView === 'week') {
            date.setDate(date.getDate() + 7);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        renderCalendar();
        document.getElementById('calendar-body').classList.remove('fade-out');
    }, 500);
});

function goToToday() {
  date = new Date();
  renderCalendar();
}

function handleViewChange() {
  const selector = document.getElementById('view-selector');
  const newView = selector.value;
  
  if (newView === currentView) return;
  
  currentView = newView;
  
  // When switching to week view, set date to today to show current week
  if (currentView === 'week') {
    date = new Date();
  }
  
  localStorage.setItem('calendar_view', currentView);
  renderCalendar();
}

function toggleView() {
  const previousView = currentView;
  currentView = currentView === 'month' ? 'week' : 'month';
  
  // When switching to week view, set date to today to show current week
  if (currentView === 'week') {
    date = new Date();
  }
  
  localStorage.setItem('calendar_view', currentView);
  renderCalendar();
}

function openForm() {
  // Clear the form when opening from the Plus button (not from a day cell click)
  document.getElementById('event-title').value = '';
  document.getElementById('event-date').value = '';
  document.getElementById('event-end-date').value = '';
  document.getElementById('event-time').value = '';
  document.getElementById('event-description').value = '';
  document.getElementById('event-location').value = '';
  document.getElementById('editing-event-id').value = '';
  const addEndTimeCheckbox = document.getElementById('add-end-time');
  if (addEndTimeCheckbox) addEndTimeCheckbox.checked = false;
  const endTimeContainer = document.getElementById('end-time-container');
  if (endTimeContainer) endTimeContainer.style.display = 'none';
  document.getElementById('event-end-time').value = '';
  const colorInput = document.getElementById('event-color');
  const colorPreview = document.getElementById('color-preview');
  if (colorInput) colorInput.value = '';
  if (colorPreview) colorPreview.textContent = 'Default';
  const allDayCheckbox = document.getElementById('all-day-event');
  if (allDayCheckbox) {
    allDayCheckbox.checked = false;
    const eventTimeInput = document.getElementById('event-time');
    if (eventTimeInput) {
      eventTimeInput.disabled = false;
      eventTimeInput.style.opacity = '1';
      eventTimeInput.style.cursor = 'auto';
    }
  }
  // Reset recurrence fields
  const repeatCheckbox = document.getElementById('repeat-event');
  const recurrenceContainer = document.getElementById('recurrence-container');
  const recurrencePattern = document.getElementById('recurrence-pattern');
  const recurrenceInterval = document.getElementById('recurrence-interval');
  const recurrenceEndDate = document.getElementById('recurrence-end-date');
  const recurrenceCount = document.getElementById('recurrence-count');
  if (repeatCheckbox) repeatCheckbox.checked = false;
  if (recurrenceContainer) recurrenceContainer.style.display = 'none';
  if (recurrencePattern) recurrencePattern.value = '';
  if (recurrenceInterval) recurrenceInterval.value = '1';
  if (recurrenceEndDate) recurrenceEndDate.value = '';
  if (recurrenceCount) recurrenceCount.value = '10';
  const noneRadio = document.querySelector('input[name="recurrence-end-type"][value="none"]');
  if (noneRadio) noneRadio.checked = true;
  document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
  const nthWeekSelect = document.getElementById('nth-week');
  const nthWeekdaySelect = document.getElementById('nth-weekday');
  if (nthWeekSelect) nthWeekSelect.value = '1';
  if (nthWeekdaySelect) nthWeekdaySelect.value = 'MON';
  const submitBtn = document.getElementById('event-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Add Event';
  const deleteBtn = document.getElementById('delete-event-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';
  document.getElementById("myForm").style.display = "block";
}

function openFormWithDate(dateStr) {
  // Open form with a pre-filled date (called from day cell click)
  openForm();
  document.getElementById('event-date').value = dateStr;
}

function closeForm() {
  document.getElementById("myForm").style.display = "none";
  // Reset all-day checkbox and re-enable time input
  const allDayCheckbox = document.getElementById('all-day-event');
  const eventTimeInput = document.getElementById('event-time');
  if (allDayCheckbox) allDayCheckbox.checked = false;
  if (eventTimeInput) {
    eventTimeInput.disabled = false;
    eventTimeInput.style.opacity = '1';
    eventTimeInput.style.cursor = 'auto';
  }
  const colorInput = document.getElementById('event-color');
  const colorPreview = document.getElementById('color-preview');
  if (colorInput) colorInput.value = '';
  if (colorPreview) colorPreview.textContent = 'Default';
  
  // Reset recurrence fields
  const repeatCheckbox = document.getElementById('repeat-event');
  const recurrenceContainer = document.getElementById('recurrence-container');
  const recurrencePattern = document.getElementById('recurrence-pattern');
  const customDaysContainer = document.getElementById('custom-days-container');
  const nthWeekdayContainer = document.getElementById('nth-weekday-container');
  if (repeatCheckbox) repeatCheckbox.checked = false;
  if (recurrenceContainer) recurrenceContainer.style.display = 'none';
  if (recurrencePattern) recurrencePattern.value = '';
  if (customDaysContainer) customDaysContainer.style.display = 'none';
  if (nthWeekdayContainer) nthWeekdayContainer.style.display = 'none';
  document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
  const nthWeekSelect = document.getElementById('nth-week');
  const nthWeekdaySelect = document.getElementById('nth-weekday');
  if (nthWeekSelect) nthWeekSelect.value = '1';
  if (nthWeekdaySelect) nthWeekdaySelect.value = 'MON';
  const recurrenceInterval = document.getElementById('recurrence-interval');
  const recurrenceEndDate = document.getElementById('recurrence-end-date');
  const recurrenceCount = document.getElementById('recurrence-count');
  if (recurrenceInterval) recurrenceInterval.value = '1';
  if (recurrenceEndDate) recurrenceEndDate.value = '';
  if (recurrenceCount) recurrenceCount.value = '10';
  const noneRadio = document.querySelector('input[name="recurrence-end-type"][value="none"]');
  if (noneRadio) noneRadio.checked = true;
} 

window.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  await checkAuthOnLoad();
});

// Track if calendar has been initialized to prevent double-initialization
let calendarInitialized = false;

// Separate initialization function that can be called after login
function initializeCalendar() {
  if (calendarInitialized) {
    return;
  }
  
  calendarInitialized = true;
  
  // Initialize the calendar on page load
  renderCalendar();
  
  // Set the view selector to match current view
  const viewSelector = document.getElementById('view-selector');
  if (viewSelector) {
    viewSelector.value = currentView;
  }

  // Color palette options (major + lighter variants)
  const colorPalette = [
    { name: 'Red', value: '#e74c3c' },
    { name: 'Red Light', value: '#f5b7b1' },
    { name: 'Orange', value: '#e67e22' },
    { name: 'Orange Light', value: '#f5cba7' },
    { name: 'Yellow', value: '#f1c40f' },
    { name: 'Yellow Light', value: '#f9e79f' },
    { name: 'Green', value: '#27ae60' },
    { name: 'Green Light', value: '#abebc6' },
    { name: 'Teal', value: '#16a085' },
    { name: 'Teal Light', value: '#a3e4d7' },
    { name: 'Blue', value: '#3498db' },
    { name: 'Blue Light', value: '#aed6f1' },
    { name: 'Purple', value: '#9b59b6' },
    { name: 'Purple Light', value: '#d7bde2' },
    { name: 'Pink', value: '#e91e63' },
    { name: 'Pink Light', value: '#f8bbd0' },
    { name: 'Gray', value: '#7f8c8d' },
    { name: 'Gray Light', value: '#d5dbdb' }
  ];

  // Build color picker swatches
  const colorOptionsEl = document.getElementById('color-options');
  const colorToggleBtn = document.getElementById('color-picker-toggle');
  const colorInput = document.getElementById('event-color');
  const colorPreview = document.getElementById('color-preview');
  if (colorOptionsEl && colorToggleBtn) {
    colorOptionsEl.innerHTML = '';
    colorPalette.forEach((c, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = c.value;
      swatch.setAttribute('aria-label', c.name);
      swatch.setAttribute('role', 'option');
      swatch.setAttribute('data-color', c.value);
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (colorInput) colorInput.value = c.value;
        if (colorPreview) colorPreview.textContent = c.name;
        colorOptionsEl.classList.add('hidden');
        colorToggleBtn.setAttribute('aria-expanded', 'false');
      });
      colorOptionsEl.appendChild(swatch);
    });

    colorToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !colorOptionsEl.classList.contains('hidden');
      colorOptionsEl.classList.toggle('hidden', isOpen);
      colorToggleBtn.setAttribute('aria-expanded', (!isOpen).toString());
    });

    // Use a named function so we can properly manage this listener
    const closeColorPickerOnOutsideClick = (e) => {
      if (!colorOptionsEl.contains(e.target) && e.target !== colorToggleBtn) {
        colorOptionsEl.classList.add('hidden');
        colorToggleBtn.setAttribute('aria-expanded', 'false');
      }
    };
    
    // Remove any existing listener first to prevent duplicates
    document.removeEventListener('click', closeColorPickerOnOutsideClick);
    document.addEventListener('click', closeColorPickerOnOutsideClick);
  }

  // Subscribe to real-time updates
  subscribeToChanges((payload) => {
    renderCalendar();
  });

  // Toggle end-time input visibility based on checkbox
  const addEndTimeCheckbox = document.getElementById('add-end-time');
  const endTimeContainer = document.getElementById('end-time-container');
  if (addEndTimeCheckbox && endTimeContainer) {
    const handleEndTimeChange = () => {
      endTimeContainer.style.display = addEndTimeCheckbox.checked ? 'block' : 'none';
      const endTimeInput = document.getElementById('event-end-time');
      if (endTimeInput && !addEndTimeCheckbox.checked) {
        endTimeInput.value = ''; // Clear end time when unchecked
      }
    };
    
    // Store the handler on the element so we can remove it later
    if (addEndTimeCheckbox._changeHandler) {
      addEndTimeCheckbox.removeEventListener('change', addEndTimeCheckbox._changeHandler);
    }
    addEndTimeCheckbox._changeHandler = handleEndTimeChange;
    addEndTimeCheckbox.addEventListener('change', handleEndTimeChange);
  }

  // Handle repeat event checkbox and recurrence UI
  const repeatCheckbox = document.getElementById('repeat-event');
  const recurrenceContainer = document.getElementById('recurrence-container');
  const recurrencePattern = document.getElementById('recurrence-pattern');
  const customDaysContainer = document.getElementById('custom-days-container');
  const intervalLabel = document.getElementById('interval-label');
  
  if (repeatCheckbox && recurrenceContainer) {
    const handleRepeatChange = () => {
      recurrenceContainer.style.display = repeatCheckbox.checked ? 'block' : 'none';
      if (!repeatCheckbox.checked) {
        if (recurrencePattern) recurrencePattern.value = '';
        if (customDaysContainer) customDaysContainer.style.display = 'none';
      }
    };
    
    // Store the handler on the element so we can remove it later
    if (repeatCheckbox._changeHandler) {
      repeatCheckbox.removeEventListener('change', repeatCheckbox._changeHandler);
    }
    repeatCheckbox._changeHandler = handleRepeatChange;
    repeatCheckbox.addEventListener('change', handleRepeatChange);
  }
  
  const nthWeekdayContainer = document.getElementById('nth-weekday-container');
  
  if (recurrencePattern && intervalLabel && customDaysContainer && nthWeekdayContainer) {
    recurrencePattern.addEventListener('change', () => {
      const pattern = recurrencePattern.value;
      customDaysContainer.style.display = (pattern === 'CUSTOM_DAYS') ? 'block' : 'none';
      nthWeekdayContainer.style.display = (pattern === 'MONTHLY_NTH') ? 'block' : 'none';
      
      // Update interval label
      switch (pattern) {
        case 'DAILY': intervalLabel.textContent = 'day(s)'; break;
        case 'WEEKLY': intervalLabel.textContent = 'week(s)'; break;
        case 'MONTHLY': intervalLabel.textContent = 'month(s)'; break;
        case 'MONTHLY_NTH': intervalLabel.textContent = 'month(s)'; break;
        case 'YEARLY': intervalLabel.textContent = 'year(s)'; break;
        case 'CUSTOM_DAYS': intervalLabel.textContent = 'week(s)'; break;
        default: intervalLabel.textContent = 'day(s)';
      }
    });
  }

  // Handle all-day event checkbox
  const allDayCheckbox = document.getElementById('all-day-event');
  const eventTimeInput = document.getElementById('event-time');
  if (allDayCheckbox) {
    allDayCheckbox.addEventListener('change', () => {
      if (eventTimeInput) {
        if (allDayCheckbox.checked) {
          eventTimeInput.disabled = true;
          eventTimeInput.style.opacity = '0.5';
          eventTimeInput.style.cursor = 'not-allowed';
          eventTimeInput.value = '';
        } else {
          eventTimeInput.disabled = false;
          eventTimeInput.style.opacity = '1';
          eventTimeInput.style.cursor = 'auto';
        }
      }
    });
  }

  // Wire up the event form
  const form = document.querySelector('#event-form');
  console.log('Looking for form:', form);
  console.log('Form already has handler?', form?._submitHandlerAttached);
  
  if (form && !form._submitHandlerAttached) {
    console.log('Attaching submit handler to form');
    form._submitHandlerAttached = true;
    
    const handleFormSubmit = async (e) => {
      console.log('Form submit handler called - preventing default');
      e.preventDefault();
      e.stopPropagation();

      const title = document.getElementById('event-title')?.value?.trim();
      const eventDate = document.getElementById('event-date')?.value; // YYYY-MM-DD
      const eventEndDate = document.getElementById('event-end-date')?.value || eventDate; // YYYY-MM-DD, defaults to start date
      const isAllDay = document.getElementById('all-day-event')?.checked || false;
      const time = isAllDay ? null : (document.getElementById('event-time')?.value || null); // HH:MM or null if all-day
      const endTime = document.getElementById('add-end-time')?.checked ? document.getElementById('event-end-time')?.value : null; // HH:MM or null
      const description = document.getElementById('event-description')?.value?.trim();
      const location = document.getElementById('event-location')?.value?.trim();
      const color = document.getElementById('event-color')?.value || null;
      
      // Capture recurrence data
      const isRepeating = document.getElementById('repeat-event')?.checked || false;
      const recurrenceRule = isRepeating ? (document.getElementById('recurrence-pattern')?.value || null) : null;
      const recurrenceInterval = isRepeating ? (parseInt(document.getElementById('recurrence-interval')?.value) || 1) : null;
      
      // Determine end type
      const endType = document.querySelector('input[name="recurrence-end-type"]:checked')?.value || 'none';
      const recurrenceEndDate = (isRepeating && endType === 'date') ? (document.getElementById('recurrence-end-date')?.value || null) : null;
      const recurrenceCount = (isRepeating && endType === 'count') ? (parseInt(document.getElementById('recurrence-count')?.value) || null) : null;
      
      let recurrenceDays = null;
      if (isRepeating && recurrenceRule === 'CUSTOM_DAYS') {
        const selectedDays = Array.from(document.querySelectorAll('.day-checkbox:checked')).map(cb => cb.value);
        recurrenceDays = selectedDays.length > 0 ? JSON.stringify(selectedDays) : null;
      }
      
      // Capture nth weekday data
      let nthWeek = null;
      let nthWeekday = null;
      if (isRepeating && recurrenceRule === 'MONTHLY_NTH') {
        nthWeek = parseInt(document.getElementById('nth-week')?.value) || 1;
        nthWeekday = document.getElementById('nth-weekday')?.value || 'MON';
      }

      if (!title || !eventDate) {
        alert('Please provide a title and date.');
        return;
      }

      const eventData = {
        title,
        startDate: eventDate,
        endDate: eventEndDate,
        isAllDay: isAllDay,
        startTime: time || null,
        description: description || null,
        endTime: endTime || null,
        location: location || null,
        color: color || null,
        recurrenceRule: recurrenceRule,
        recurrenceInterval: recurrenceInterval,
        recurrenceDays: recurrenceDays,
        recurrenceEndDate: recurrenceEndDate,
        recurrenceCount: recurrenceCount,
        nthWeek: nthWeek,
        nthWeekday: nthWeekday
      };

      try {
        const editingId = document.getElementById('editing-event-id')?.value;
        if (editingId) {
          // Perform update
          const updates = {
            title,
            description: description || null,
            start_date: eventDate,
            end_date: eventEndDate,
            is_all_day: isAllDay,
            start_time: time || null,
            end_time: endTime || null,
            location: location || null,
            color: color || null,
            recurrence_rule: recurrenceRule,
            recurrence_interval: recurrenceInterval,
            recurrence_days: recurrenceDays,
            recurrence_end_date: recurrenceEndDate,
            recurrence_count: recurrenceCount,
            nth_week: nthWeek,
            nth_weekday: nthWeekday
          };
          const updated = await updateEvent(editingId, updates);
          if (updated) {
            // Reset editing state
            document.getElementById('editing-event-id').value = '';
            const submitBtn = document.getElementById('event-submit-btn'); if (submitBtn) submitBtn.textContent = 'Add Event';
            closeForm();
            await renderCalendar();
            // Clear form fields
            document.getElementById('event-title').value = '';
            document.getElementById('event-date').value = '';
            document.getElementById('event-time').value = '';
            document.getElementById('event-description').value = '';
            document.getElementById('event-location').value = '';
            if (addEndTimeCheckbox) addEndTimeCheckbox.checked = false;
            if (endTimeContainer) endTimeContainer.style.display = 'none';
            document.getElementById('event-end-time').value = '';
          } else {
            alert('Failed to update event. See console for details.');
          }
        } else {
          const created = await createEvent(eventData);
          if (created) {
            closeForm();
            await renderCalendar();
            // Clear form fields
            document.getElementById('event-title').value = '';
            document.getElementById('event-date').value = '';
            document.getElementById('event-time').value = '';
            document.getElementById('event-description').value = '';
            document.getElementById('event-location').value = '';
            if (addEndTimeCheckbox) addEndTimeCheckbox.checked = false;
            if (endTimeContainer) endTimeContainer.style.display = 'none';2018-12-11
            document.getElementById('event-end-time').value = '';
            const colorInput = document.getElementById('event-color');
            const colorPreview = document.getElementById('color-preview');
            if (colorInput) colorInput.value = '';
            if (colorPreview) colorPreview.textContent = 'Default';
          } else {
            alert('Failed to create event. See console for details.');
          }
        }
      } catch (err) {
        console.error('Error creating/updating event:', err);
        alert('Error creating/updating event. See console.');
      }
    };
    
    form.addEventListener('submit', handleFormSubmit);
  }

  // Close modal when clicking outside it
  const modal = document.getElementById('event-detail-modal');
  if (modal) {
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEventModal();
      }
    });
  }

  // Month/Year picker behavior
  const monthLabel = document.getElementById('month');
  const picker = document.getElementById('month-year-picker');
  const yearSelect = document.getElementById('year-select');
  const monthSelect = document.getElementById('month-select');
  const pickerGo = document.getElementById('picker-go');
  const pickerCancel = document.getElementById('picker-cancel');

  function hidePicker() {
    if (picker) {
      picker.classList.add('hidden');
      picker.setAttribute('aria-hidden', 'true');
    }
    document.removeEventListener('click', outsideClickHandler);
  }

  function outsideClickHandler(e) {
    if (!picker) return;
    if (!picker.contains(e.target) && e.target !== monthLabel) hidePicker();
  }

  function showPicker() {
    if (!picker || !yearSelect || !monthSelect) return;
    populatePicker();
    picker.classList.remove('hidden');
    picker.setAttribute('aria-hidden', 'false');
    // listen for outside clicks
    setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);
  }

  function populatePicker() {
    const nowYear = new Date().getFullYear();
    // Provide a +/-10 year range
    const start = nowYear - 10;
    const end = nowYear + 10;
    yearSelect.innerHTML = '';
    for (let y = start; y <= end; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(date.getFullYear());

    // populate months
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthSelect.innerHTML = '';
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
    monthSelect.value = String(date.getMonth());
    monthSelect.disabled = false;
  }

  if (monthLabel) {
    monthLabel.style.cursor = 'pointer';
    monthLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (picker && !picker.classList.contains('hidden')) hidePicker(); else showPicker();
    });
  }

  if (pickerCancel) pickerCancel.addEventListener('click', (e) => { e.stopPropagation(); hidePicker(); });
  if (pickerGo) pickerGo.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const y = parseInt(yearSelect.value, 10);
    const m = parseInt(monthSelect.value, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return;
    date = new Date(y, m, 1);
    hidePicker();
    renderCalendar();
  });
}