// Show a modal listing all events for a given day
function showDayDetailsModal(dateStr) {
  const modal = document.getElementById('event-detail-modal');
  if (!modal) return;
  const dayEvents = calendarEvents.filter(ev => ev.start_date === dateStr);
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  let html = `<div class="modal-content">
    <div class="modal-header">
      <h2 class="modal-title">${dateLabel}</h2>
      <button class="modal-close" onclick="closeEventModal()">&times;</button>
    </div>
    <div class="modal-events-list">`;
  if (dayEvents.length === 0) {
    html += `<div class="no-events">No events for this day.</div>`;
  } else {
    // Sort: all-day events first, then by start_time
    const sortedEvents = [...dayEvents].sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
    sortedEvents.forEach((ev, idx) => {
      let timeStr = '';
      if (ev.start_time && ev.end_time) {
        timeStr = `${ev.start_time.slice(0,5)} - ${ev.end_time.slice(0,5)}`;
      } else if (ev.start_time) {
        timeStr = `${ev.start_time.slice(0,5)}`;
      }
      html += `<div class="modal-event-item">
        <div class="event-title-row">
          <span class="event-title" onclick="showEventModal('${ev.id}','${dateStr}',${idx})">${ev.title || '(No Title)'}</span>
          <div class="event-actions">
            <button class="event-edit-btn" title="Edit" onclick="event.stopPropagation();startEditEvent('${ev.id}','${dateStr}',${idx})">✎</button>
            <button class="event-duplicate-btn" title="Duplicate" onclick="event.stopPropagation();duplicateEvent('${ev.id}','${dateStr}',${idx})">🗍</button>
            <button class="event-delete-btn" title="Delete" onclick="event.stopPropagation();handleDayDetailDelete('${ev.id}','${dateStr}',${idx})">🗑</button>
          </div>
        </div>
        ${timeStr ? `<div class='event-times'><span class='event-time'>${timeStr}</span></div>` : ''}
        ${ev.location ? `<div class='event-location'><b>Location:</b> ${ev.location}</div>` : ''}
        ${ev.description ? `<div class='event-description'><b>Description:</b> ${ev.description}</div>` : ''}
      </div>`;
    });
  }
  html += `</div></div>`;
  modal.innerHTML = html;
  modal.classList.add('show');
}

// Helper to handle delete from day details modal, showing recurring popup if needed
window.handleDayDetailDelete = function(eventId, dateStr, idx) {
  const event = calendarEvents.find(e => String(e.id) === String(eventId) && e.start_date === dateStr) || calendarEvents.find(e => String(e.id) === String(eventId));
  if (!event) {
    alert('Event not found');
    return;
  }
  const isRecurringInstance = event.is_recurring_instance || (event.recurrence_rule && event.recurrence_rule !== 'NONE' && event.recurrence_rule !== '');
  if (isRecurringInstance) {
    // Use the same handler as event modal
    handleRecurringEventDelete(event.original_event_id || event.id, dateStr);
  } else {
    deleteEventFromModal(event.id);
  }
}