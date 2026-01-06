// GiftPlan.js - Full backend logic for Gift Plan page
// Uses supabaseClient (from supabase.js)

// --- State ---
let currentYear = null;

// --- Persisted Year ---
const YEAR_STORAGE_KEY = 'giftplan_selected_year';
let allYears = [];
let allPeople = [];
let allGifts = [];
let selectedPersonId = null; // null or 'me' for "Me" view, or a person UUID

// Special constant for "Me" view
const ME_ID = 'me';

// --- Utility ---
function formatCurrency(amount) {
  return `$${(+amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function capitalizeOccasion(occasion) {
  if (!occasion) return '';
  return occasion.charAt(0).toUpperCase() + occasion.slice(1).toLowerCase();
}

// --- Fetch Data ---
// Fetches all years for the year selector, following the rolling window + historical logic
async function fetchYears() {
  console.log('[GiftPlan] Fetching years for selector...');
  const now = new Date();
  const currentYear = now.getFullYear();
  const rollingWindow = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  let historicalYears = [];
  try {
    // Query for all distinct years < (currentYear - 1) that have data
    const { data, error } = await supabaseClient
      .from('gifts')
      .select('year')
      .lt('year', currentYear - 1);
    if (error) {
      console.error('[GiftPlan] Error fetching historical years:', error);
      return rollingWindow;
    }
    historicalYears = [...new Set((data || []).map(g => g.year))];
    // Filter out any null/undefined and non-numeric years
    historicalYears = historicalYears.filter(y => typeof y === 'number' && !isNaN(y));
    console.log('[GiftPlan] Historical years found:', historicalYears);
  } catch (err) {
    console.error('[GiftPlan] Exception fetching historical years:', err);
    // Fallback to just rolling window
    return rollingWindow;
  }
  // Combine, dedupe, and sort ascending
  const allYears = Array.from(new Set([...historicalYears, ...rollingWindow])).sort((a, b) => a - b);
  console.log('[GiftPlan] Final year list:', allYears);
  return allYears;
}

async function fetchPeople(year) {
  console.log('[GiftPlan] Fetching people for year:', year);
  try {
    // Get people for the selected year (distinct person_ids from gifts)
    const { data: giftPeople, error: err1 } = await supabaseClient
      .from('gifts')
      .select('person_id')
      .eq('year', year);
    if (err1) {
      console.error('[GiftPlan] Error fetching gift people:', err1);
      return [];
    }
    const personIds = [...new Set((giftPeople || []).map(g => g.person_id).filter(id => id))];
    console.log('[GiftPlan] Person IDs found:', personIds);
    if (!personIds.length) return [];
    const { data: people, error: err2 } = await supabaseClient
      .from('people')
      .select('*')
      .in('id', personIds)
      .order('name');
    if (err2) {
      console.error('[GiftPlan] Error fetching people:', err2);
      return [];
    }
    console.log('[GiftPlan] People found:', people);
    return people || [];
  } catch (err) {
    console.error('[GiftPlan] Exception fetching people:', err);
    return [];
  }
}

async function fetchGifts(year) {
  console.log('[GiftPlan] Fetching gifts for year:', year);
  try {
    const { data, error } = await supabaseClient
      .from('gifts')
      .select('*')
      .eq('year', year);
    if (error) {
      console.error('[GiftPlan] Error fetching gifts:', error);
      return [];
    }
    console.log('[GiftPlan] Gifts found:', data);
    return data || [];
  } catch (err) {
    console.error('[GiftPlan] Exception fetching gifts:', err);
    return [];
  }
}

// --- Main Data Loader ---
async function loadData() {
  console.log('[GiftPlan] Loading data...');

  // Fetch all years
  allYears = await fetchYears();

  // If no years, default to current year
  if (!allYears.length) {
    const thisYear = new Date().getFullYear();
    allYears = [thisYear];
    console.log('[GiftPlan] No years found, defaulting to:', thisYear);
  }

  // Restore last selected year from localStorage if available and valid
  if (!currentYear) {
    const storedYear = parseInt(localStorage.getItem(YEAR_STORAGE_KEY), 10);
    if (storedYear && allYears.includes(storedYear)) {
      currentYear = storedYear;
      console.log('[GiftPlan] Restored year from storage:', currentYear);
    } else {
      currentYear = allYears[0];
    }
  }

  renderYearSelector();

  // Fetch people and gifts for selected year
  allPeople = await fetchPeople(currentYear);
  allGifts = await fetchGifts(currentYear);

  // Default to "Me" view if no person selected
  if (!selectedPersonId) {
    selectedPersonId = ME_ID;
  }

  renderPeopleList();
  renderGifts();
  renderTotals();

  console.log('[GiftPlan] Data loaded. Year:', currentYear, 'People:', allPeople.length, 'Gifts:', allGifts.length);
}

// --- Render Functions ---
// Renders the year selector dropdown with correct order and default selection
// Only call this on initial load - NOT when user changes the year selector
function renderYearSelector() {
  const sel = document.getElementById('year-select');
  if (!sel) return;
  if (allYears.length === 0) {
    sel.innerHTML = '<option value="">No years</option>';
    return;
  }
  // Ascending order (should already be sorted, but just in case)
  const sortedYears = [...allYears].sort((a, b) => a - b);
  sel.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
  
  // Only set currentYear if it hasn't been set yet (initial load)
  // This prevents overwriting user's selection when called from handleYearChange
  if (!currentYear || !sortedYears.includes(currentYear)) {
    const now = new Date();
    const thisYear = now.getFullYear();
    currentYear = sortedYears.includes(thisYear) ? thisYear : sortedYears[0];
  }
  
  // Set the dropdown to match currentYear
  sel.value = currentYear;
  console.log('[GiftPlan] renderYearSelector - currentYear:', currentYear, 'dropdown value:', sel.value);
}

function renderPeopleList() {
  const ul = document.getElementById('people-list');
  if (!ul) return;
  ul.innerHTML = '';
  
  // --- "Me" / All Gifts entry at top ---
  const meLi = document.createElement('li');
  meLi.className = 'me-entry' + (selectedPersonId === ME_ID ? ' selected' : '');
  const meText = document.createElement('span');
  meText.className = 'person-name';
  meText.textContent = '👤 All Gifts';
  meLi.appendChild(meText);
  meLi.onclick = () => selectPerson(ME_ID);
  ul.appendChild(meLi);
  
  // --- Empty state for no people ---
  if (allPeople.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'No people added for this year yet.';
    ul.appendChild(emptyLi);
    return;
  }
  
  // --- Regular people ---
  allPeople.forEach(person => {
    const li = document.createElement('li');
    li.className = person.id === selectedPersonId ? 'selected' : '';
    li.onclick = () => selectPerson(person.id);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'person-name';
    nameSpan.textContent = person.name;
    nameSpan.title = person.birthday ? `Birthday: ${person.birthday}` : '';
    li.appendChild(nameSpan);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete Person';
    delBtn.onclick = e => { e.stopPropagation(); deletePerson(person.id); };
    li.appendChild(delBtn);
    
    ul.appendChild(li);
  });
}

function renderGifts() {
  const givenList = document.getElementById('gifts-given-list');
  const receivedList = document.getElementById('gifts-received-list');
  if (!givenList || !receivedList) return;
  
  givenList.innerHTML = '';
  receivedList.innerHTML = '';
  
  // Determine which gifts to show based on selection
  let giftsGiven, giftsReceived;
  
  if (selectedPersonId === ME_ID) {
    // "Me" view: Show ALL gifts for this year
    giftsGiven = allGifts.filter(g => g.type === 'given');
    giftsReceived = allGifts.filter(g => g.type === 'received');
  } else if (selectedPersonId) {
    // Specific person view
    giftsGiven = allGifts.filter(g => g.person_id === selectedPersonId && g.type === 'given');
    giftsReceived = allGifts.filter(g => g.person_id === selectedPersonId && g.type === 'received');
  } else {
    giftsGiven = [];
    giftsReceived = [];
  }
  
  // --- Gifts to Give ---
  if (giftsGiven.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'No gifts yet. Click + to add one.';
    givenList.appendChild(emptyLi);
  } else {
    giftsGiven.forEach(gift => {
      // Skip empty placeholder gifts
      if (!gift.item && !gift.store && !gift.cost) return;
      
      const li = document.createElement('li');
      
      // Status checkbox
      const statusBtn = document.createElement('span');
      statusBtn.className = `gift-status ${gift.status}`;
      statusBtn.title = 'Click to change status';
      statusBtn.innerHTML = gift.status === 'idea' ? '☐' : (gift.status === 'purchased' ? '✔️' : '❌');
      statusBtn.onclick = e => { e.stopPropagation(); cycleGiftStatus(gift); };
      li.appendChild(statusBtn);
      
      // Gift info
      const info = document.createElement('span');
      info.className = 'gift-info';
      
      // For "Me" view, show person name
      let personLabel = '';
      if (selectedPersonId === ME_ID) {
        const person = allPeople.find(p => p.id === gift.person_id);
        personLabel = person ? `<span class="gift-person">${person.name}</span> ` : '';
      }
      
      info.innerHTML = `${personLabel}<strong>${gift.item || '(No item)'}</strong> <span class="gift-occasion">[${capitalizeOccasion(gift.occasion)}]</span> <span class="gift-store">${gift.store || ''}</span> <span class="gift-cost">${gift.cost ? formatCurrency(gift.cost) : ''}</span>`;
      info.onclick = () => openGiftModal(gift);
      li.appendChild(info);
      
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete Gift';
      delBtn.onclick = e => { e.stopPropagation(); deleteGift(gift.id); };
      li.appendChild(delBtn);
      
      givenList.appendChild(li);
    });
  }
  
  // --- Gifts Received ---
  if (giftsReceived.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'No gifts received yet. Click + to add one.';
    receivedList.appendChild(emptyLi);
  } else {
    giftsReceived.forEach(gift => {
      // Skip empty placeholder gifts
      if (!gift.item) return;
      
      const li = document.createElement('li');
      
      // Gift info
      const info = document.createElement('span');
      info.className = 'gift-info';
      
      // For "Me" view, show person name
      let personLabel = '';
      if (selectedPersonId === ME_ID) {
        const person = allPeople.find(p => p.id === gift.person_id);
        personLabel = person ? `<span class="gift-person">${person.name}</span> ` : '';
      }
      
      info.innerHTML = `${personLabel}<strong>${gift.item || '(No item)'}</strong> <span class="gift-occasion">[${capitalizeOccasion(gift.occasion)}]</span> <span class="gift-notes">${gift.notes || ''}</span>`;
      info.onclick = () => openGiftModal(gift);
      li.appendChild(info);
      
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete Gift';
      delBtn.onclick = e => { e.stopPropagation(); deleteGift(gift.id); };
      li.appendChild(delBtn);
      
      receivedList.appendChild(li);
    });
  }
}

// --- Totals ---
function renderTotals() {
  let personTotal, allTotal;
  
  if (selectedPersonId === ME_ID) {
    // "Me" view: total is ALL purchased gifts for this year
    personTotal = allGifts.filter(g => g.type === 'given' && g.status === 'purchased').reduce((sum, g) => sum + (+g.cost || 0), 0);
  } else if (selectedPersonId) {
    // Specific person: only their purchased gifts
    personTotal = allGifts.filter(g => g.person_id === selectedPersonId && g.type === 'given' && g.status === 'purchased').reduce((sum, g) => sum + (+g.cost || 0), 0);
  } else {
    personTotal = 0;
  }
  
  // All people total (always shows total for the year)
  allTotal = allGifts.filter(g => g.type === 'given' && g.status === 'purchased').reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  const givenTotalEl = document.getElementById('gifts-given-total');
  const allTotalEl = document.getElementById('total-cost-all');
  
  if (givenTotalEl) givenTotalEl.textContent = `Total: ${formatCurrency(personTotal)}`;
  if (allTotalEl) allTotalEl.textContent = `Total: ${formatCurrency(allTotal)}`;
}

// --- Event Handlers ---
function selectPerson(personId) {
  console.log('[GiftPlan] Selected person:', personId);
  selectedPersonId = personId;
  renderPeopleList();
  renderGifts();
  renderTotals();
}

// Handles year selection change: updates currentYear, reloads data for that year
// NOTE: Do NOT call renderYearSelector() here - the user already changed the dropdown,
// and renderYearSelector() would reset currentYear back to the actual current year (2026)
async function handleYearChange(e) {
  const newYear = +e.target.value;
  console.log('[GiftPlan] handleYearChange called - newYear:', newYear, 'currentYear:', currentYear);

  if (currentYear === newYear) {
    console.log('[GiftPlan] Same year selected, no change needed');
    return;
  }

  // Update the current year state
  currentYear = newYear;
  // Persist the selected year
  localStorage.setItem(YEAR_STORAGE_KEY, currentYear);
  console.log('[GiftPlan] Year changed to:', currentYear);

  // Reset to "Me" view when year changes
  selectedPersonId = ME_ID;

  // Fetch people and gifts for the new year
  console.log('[GiftPlan] Fetching data for year:', currentYear);
  allPeople = await fetchPeople(currentYear);
  allGifts = await fetchGifts(currentYear);
  console.log('[GiftPlan] Data fetched - People:', allPeople.length, 'Gifts:', allGifts.length);

  // Re-render the UI with new data (do NOT re-render year selector)
  renderPeopleList();
  renderGifts();
  renderTotals();

  console.log('[GiftPlan] Year change complete - now showing year:', currentYear);
}

// --- Initialize event listeners after DOM is ready ---
function initEventListeners() {
  const yearSelect = document.getElementById('year-select');
  if (yearSelect) {
    yearSelect.addEventListener('change', handleYearChange);
  }
  
  const addPersonBtn = document.getElementById('add-person-btn');
  if (addPersonBtn) {
    addPersonBtn.onclick = () => {
      document.getElementById('modal-overlay').style.display = 'block';
      document.getElementById('person-modal').style.display = 'block';
    };
  }
  
  const personForm = document.getElementById('person-form');
  if (personForm) {
    personForm.onsubmit = async function(e) {
      e.preventDefault();
      const name = document.getElementById('person-name').value.trim();
      const birthday = document.getElementById('person-birthday').value.trim();
      if (!name) return;
      
      console.log('[GiftPlan] Adding person:', name, birthday);
      
      try {
        const { data, error } = await supabaseClient.from('people').insert([{ name, birthday }]).select();
        if (error) {
          console.error('[GiftPlan] Error adding person:', error);
          return;
        }
        if (data && data[0]) {
          // Add a placeholder gift to link person to year
          await supabaseClient.from('gifts').insert([{ 
            person_id: data[0].id, 
            year: currentYear, 
            type: 'given', 
            status: 'idea', 
            item: '', 
            occasion: 'christmas', 
            notes: '', 
            store: '', 
            cost: 0 
          }]);
          closePersonModal();
          await loadData();
          selectPerson(data[0].id);
        }
      } catch (err) {
        console.error('[GiftPlan] Exception adding person:', err);
      }
    };
  }
  
  const addGiftBtn = document.getElementById('add-gift-btn');
  if (addGiftBtn) {
    addGiftBtn.onclick = () => {
      if (selectedPersonId === ME_ID) {
        alert('Please select a specific person to add a gift for them.');
        return;
      }
      openGiftModal(null, 'given');
    };
  }
  
  const addReceivedGiftBtn = document.getElementById('add-received-gift-btn');
  if (addReceivedGiftBtn) {
    addReceivedGiftBtn.onclick = () => {
      if (selectedPersonId === ME_ID) {
        alert('Please select a specific person to add a received gift.');
        return;
      }
      openGiftModal(null, 'received');
    };
  }
  
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.onclick = () => {
      closePersonModal();
      closeGiftModal();
    };
  }
}

function closePersonModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('person-modal');
  const form = document.getElementById('person-form');
  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
}
window.closePersonModal = closePersonModal;

// --- Gift Modal ---
let editingGiftType = 'given'; // Track if we're adding given or received

function openGiftModal(gift, type = 'given') {
  editingGiftType = gift ? gift.type : type;
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  
  const title = gift ? 'Edit Gift' : (editingGiftType === 'received' ? 'Add Received Gift' : 'Add Gift');
  document.getElementById('gift-modal-title').textContent = title;
  
  document.getElementById('gift-item').value = gift?.item || '';
  // Handle lowercase occasion values from database
  const occasionValue = gift?.occasion ? gift.occasion.toLowerCase() : 'christmas';
  document.getElementById('gift-occasion').value = occasionValue;
  document.getElementById('gift-store').value = gift?.store || '';
  document.getElementById('gift-cost').value = gift?.cost || '';
  document.getElementById('gift-notes').value = gift?.notes || '';
  
  document.getElementById('gift-form').onsubmit = async function(e) {
    e.preventDefault();
    const item = document.getElementById('gift-item').value.trim();
    const occasion = document.getElementById('gift-occasion').value.toLowerCase(); // Store lowercase
    const store = document.getElementById('gift-store').value.trim();
    const cost = +document.getElementById('gift-cost').value || 0;
    const notes = document.getElementById('gift-notes').value.trim();
    
    try {
      if (gift) {
        // Update existing gift
        console.log('[GiftPlan] Updating gift:', gift.id);
        const { error } = await supabaseClient.from('gifts').update({ item, occasion, store, cost, notes }).eq('id', gift.id);
        if (error) console.error('[GiftPlan] Error updating gift:', error);
      } else {
        // Insert new gift
        console.log('[GiftPlan] Adding new gift for person:', selectedPersonId);
        const { error } = await supabaseClient.from('gifts').insert([{ 
          person_id: selectedPersonId, 
          year: currentYear, 
          type: editingGiftType, 
          status: 'idea', 
          item, 
          occasion, 
          store, 
          cost, 
          notes 
        }]);
        if (error) console.error('[GiftPlan] Error adding gift:', error);
      }
      closeGiftModal();
      await loadData();
    } catch (err) {
      console.error('[GiftPlan] Exception saving gift:', err);
    }
  };
}
window.openGiftModal = openGiftModal;

function closeGiftModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('gift-modal');
  const form = document.getElementById('gift-form');
  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
}
window.closeGiftModal = closeGiftModal;

// --- Status Cycling ---
async function cycleGiftStatus(gift) {
  const next = gift.status === 'idea' ? 'purchased' : (gift.status === 'purchased' ? 'rejected' : 'idea');
  console.log('[GiftPlan] Cycling status:', gift.id, gift.status, '->', next);
  try {
    const { error } = await supabaseClient.from('gifts').update({ status: next }).eq('id', gift.id);
    if (error) console.error('[GiftPlan] Error updating status:', error);
    await loadData();
  } catch (err) {
    console.error('[GiftPlan] Exception updating status:', err);
  }
}

// --- Delete ---
async function deleteGift(giftId) {
  if (!confirm('Delete this gift?')) return;
  console.log('[GiftPlan] Deleting gift:', giftId);
  try {
    const { error } = await supabaseClient.from('gifts').delete().eq('id', giftId);
    if (error) console.error('[GiftPlan] Error deleting gift:', error);
    await loadData();
  } catch (err) {
    console.error('[GiftPlan] Exception deleting gift:', err);
  }
}

async function deletePerson(personId) {
  if (!confirm('Delete this person and all their gifts?')) return;
  console.log('[GiftPlan] Deleting person:', personId);
  try {
    // Delete gifts first (foreign key)
    await supabaseClient.from('gifts').delete().eq('person_id', personId);
    // Then delete person
    const { error } = await supabaseClient.from('people').delete().eq('id', personId);
    if (error) console.error('[GiftPlan] Error deleting person:', error);
    if (selectedPersonId === personId) selectedPersonId = ME_ID;
    await loadData();
  } catch (err) {
    console.error('[GiftPlan] Exception deleting person:', err);
  }
}

// --- Navigation Handler ---
function handleNavigation(select) {
  const value = select.value;
  if (value) {
    window.location.href = value;
  }
}

// --- Initialize on page load ---
// Wait for DOM and authentication
function initGiftPlan() {
  console.log('[GiftPlan] Initializing...');
  initEventListeners();
  loadData();
}

// This will be called when giftplan-app is shown (after auth)
// We override showCalendar in the HTML to call this
const originalShowGiftPlan = window.showGiftPlan || function() {};
window.showGiftPlan = function() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('giftplan-app').style.display = 'block';
  // Initialize after showing
  setTimeout(initGiftPlan, 100);
};

// Also try to init on DOMContentLoaded if already authenticated
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure supabase is ready
  setTimeout(() => {
    const app = document.getElementById('giftplan-app');
    if (app && app.style.display !== 'none') {
      initGiftPlan();
    }
  }, 200);
});
