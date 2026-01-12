// --- Gift Action Modal ---
let currentGiftForAction = null;

function ensureGiftActionModal() {
  if (document.getElementById('gift-action-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'gift-action-modal';
  modal.className = 'modal';
  modal.style.background = 'rgba(26,26,26,0.92)';
  modal.innerHTML = `
    <div class="modal-content gift-action-modal-content" style="background:#1a1a1a;min-width:320px;max-width:95vw;padding:24px 20px 18px 20px;box-shadow:0 4px 24px rgba(0,0,0,0.18);border-radius:12px;color:#f2f2f2;">
      <span id="close-gift-action-modal" class="close" style="font-size:1.7em;position:absolute;top:10px;right:18px;cursor:pointer;color:#f2f2f2;">&times;</span>
      <div id="gift-action-modal-title" class="modal-title" style="font-size:1.2em;font-weight:600;margin-bottom:18px;color:#f2f2f2;"></div>
      <div id="gift-action-modal-body" style="display:flex;flex-direction:column;align-items:center;gap:18px;">
        <div id="gift-action-notes-section" style="width:100%;margin-bottom:12px;">
          <label for="gift-action-notes-text" style="font-size:0.98em;font-weight:500;display:block;margin-bottom:4px;color:#f2f2f2;">Notes</label>
          <p id="gift-action-notes-text" style="margin:0;padding:7px 10px;border-radius:6px;background:#232323;color:#f2f2f2;font-size:1em;box-sizing:border-box;min-height:38px;white-space:pre-line;"></p>
          <button id="gift-action-save-notes-btn" style="margin-top:7px;padding:6px 18px;border-radius:6px;background:#2d7cff;color:#fff;border:none;font-size:1em;cursor:pointer;float:right;display:none;">💾 Save</button>
        </div>
        <div style="display:flex;gap:18px;justify-content:center;width:100%;margin-top:8px;">
          <button id="gift-action-edit-btn" title="Edit Notes" class="icon-btn" style="font-size:1.5em;background:none;border:none;cursor:pointer;color:#f2f2f2;">✏️</button>
          <button id="gift-action-delete-btn" title="Delete Gift" class="icon-btn" style="font-size:1.5em;background:none;border:none;cursor:pointer;color:#f2f2f2;">🗑️</button>
          <button id="gift-action-copy-grocery-btn" title="Copy to Groceries" class="icon-btn" style="font-size:1.5em;background:none;border:none;cursor:pointer;color:#f2f2f2;">🛒</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Close modal handler
  document.getElementById('close-gift-action-modal').onclick = closeGiftActionModal;
  // Clicking outside modal closes it
  modal.onclick = function(e) {
    if (e.target === modal) closeGiftActionModal();
  };
}

function openGiftActionModal(gift) {
  ensureGiftActionModal();
  currentGiftForAction = gift;
  document.getElementById('gift-action-modal-title').textContent = gift.item || '(No item)';
  document.getElementById('gift-action-modal').style.display = 'block';
  // Show notes and set value
  const notesTextarea = document.getElementById('gift-action-notes-text');
  const saveBtn = document.getElementById('gift-action-save-notes-btn');
  notesTextarea.value = gift.notes || '';
  notesTextarea.readOnly = true;
  saveBtn.style.display = 'none';

  // Edit button opens full edit gift modal
  document.getElementById('gift-action-edit-btn').onclick = function() {
    closeGiftActionModal();
    openEditGiftModal(gift);
  };
  document.getElementById('gift-action-delete-btn').onclick = function() {
    closeGiftActionModal();
    deleteGift(gift.id);
  };
  document.getElementById('gift-action-copy-grocery-btn').onclick = async function() {
    closeGiftActionModal();
    await copyGiftToGrocery(gift);
  };
  saveBtn.onclick = async function() {
    const notes = notesTextarea.value;
    await updateGiftNotes(gift.id, notes);
    notesTextarea.readOnly = true;
    saveBtn.style.display = 'none';
    closeGiftActionModal();
    // Update local state and re-render
    if (gift) gift.notes = notes;
    renderGiftIdeas();
    renderGiftsGiven();
    renderGiftsReceived();
  };
}

function closeGiftActionModal() {
  const modal = document.getElementById('gift-action-modal');
  if (modal) modal.style.display = 'none';
  currentGiftForAction = null;
}

async function updateGiftNotes(giftId, notes) {
  try {
    const { error } = await supabaseClient
      .from('gifts')
      .update({ notes })
      .eq('id', giftId);
    if (error) {
      alert('Failed to update notes.');
      console.error('[GiftPlan] Error updating notes:', error);
    }
  } catch (err) {
    alert('Failed to update notes.');
    console.error('[GiftPlan] Exception updating notes:', err);
  }
}

// Expose for use in createGiftBox/createGiftColumnBox
window.openGiftActionModal = openGiftActionModal;

// Do not auto-show or auto-create the modal on DOMContentLoaded. Only create/show when needed.

// --- Mobile State ---
let mobileSubView = 'people'; // 'people', 'ideas', 'given-received' (for People View sub-navigation)

// --- Mobile Detection ---
function isMobileView() {
  return window.innerWidth <= 768;
}

// --- Mobile Bottom Tabs ---
function switchMobileTab(view) {
  // Update bottom tab styling
  document.querySelectorAll('.mobile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Switch to the main view
  switchView(view);
  
  // Reset mobile sub-view when switching tabs
  if (view === 'people') {
    mobileSubView = selectedPersonId ? 'ideas' : 'people';
  }
  updateMobilePeopleViewLayout();
}
window.switchMobileTab = switchMobileTab;

// --- Mobile People View Sub-Navigation ---
function mobileBackToPeople() {
  mobileSubView = 'people';
  updateMobilePeopleViewLayout();
}
window.mobileBackToPeople = mobileBackToPeople;

function mobileToggleToGivenReceived() {
  mobileSubView = 'given-received';
  updateMobilePeopleViewLayout();
}
window.mobileToggleToGivenReceived = mobileToggleToGivenReceived;

function mobileToggleToIdeas() {
  mobileSubView = 'ideas';
  updateMobilePeopleViewLayout();
}
window.mobileToggleToIdeas = mobileToggleToIdeas;

// --- Update Mobile People View Layout ---
function updateMobilePeopleViewLayout() {
  if (!isMobileView()) {
    // Desktop: remove mobile classes and show bottom tabs
    const peopleView = document.getElementById('people-view');
    if (peopleView) {
      peopleView.classList.remove('mobile-show-people', 'mobile-show-ideas', 'mobile-show-given-received');
    }
    const bottomTabs = document.querySelector('.mobile-bottom-tabs');
    if (bottomTabs) bottomTabs.style.display = 'none';
    const mobileStatsHeader = document.querySelector('.mobile-stats-header');
    if (mobileStatsHeader) mobileStatsHeader.style.display = 'none';
    return;
  }
  
  // Mobile: show bottom tabs
  const bottomTabs = document.querySelector('.mobile-bottom-tabs');
  if (bottomTabs) bottomTabs.style.display = 'flex';
  
  // Update bottom tab active state
  document.querySelectorAll('.mobile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === currentView);
  });
  
  const peopleView = document.getElementById('people-view');
  if (!peopleView) return;
  
  // Remove all mobile sub-view classes
  peopleView.classList.remove('mobile-show-people', 'mobile-show-ideas', 'mobile-show-given-received');
  
  // Apply the appropriate class based on mobileSubView
  if (currentView === 'people') {
    peopleView.classList.add(`mobile-show-${mobileSubView}`);
    
    // Show/hide mobile stats header
    const mobileStatsHeader = document.querySelector('.mobile-stats-header');
    if (mobileStatsHeader) {
      mobileStatsHeader.style.display = mobileSubView === 'given-received' ? 'flex' : 'none';
    }
  }
}

// --- Update Mobile Selected State (called when person is selected) ---
function updateMobilePeopleSelectedState() {
  if (isMobileView() && currentView === 'people' && selectedPersonId) {
    // When a person is selected on mobile, show their ideas
    mobileSubView = 'ideas';
    updateMobilePeopleViewLayout();
  }
}
// GiftPlan.js - Full backend logic for Gift Plan page (Part 3 - People View + Year Plan View + Stats & History)
// Uses supabaseClient (from supabase.js)

// --- State ---
// --- Persistent State ---
let currentView = localStorage.getItem('giftplan_currentView') || 'people'; // 'people' or 'yearplan'
let editingPerson = null; // For summary modal
let currentYear = new Date().getFullYear();
let yearPlanYear = parseInt(localStorage.getItem('giftplan_yearPlanYear'), 10) || new Date().getFullYear();
let showAllYears = localStorage.getItem('giftplan_showAllYears') === 'true'; // Toggle for year filter in People View
let showArchivedPeople = false; // Toggle for archived section

let allPeopleList = [];
let allPeople = [];
let archivedPeople = [];
let allGiftsForPerson = [];
let yearPlanGifts = [];
let selectedPersonId = localStorage.getItem('giftplan_selectedPersonId') || null;

// Modal state
let giftModalMode = 'people'; // 'people', 'yearplan-given', 'yearplan-received', 'edit'
let editingGift = null;
let pendingPersonCallback = null; // Callback after adding person from gift modal

// History state
let historyYearsShown = 5; // Start with 5 years
let collapsedYears = new Set(); // Track which years are collapsed

// --- Utility ---
function formatCurrency(amount) {
  return `$${(+amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function capitalizeOccasion(occasion) {
  if (!occasion) return 'Anytime';
  const map = {
    'christmas': 'Christmas',
    'birthday': 'Birthday',
    'valentines': "Valentine's Day",
    'anniversary': 'Anniversary',
    'mothersday': "Mother's Day",
    'fathersday': "Father's Day",
    'easter': 'Easter',
    'graduation': 'Graduation',
    'other': 'Other'
  };
  return map[occasion.toLowerCase()] || occasion.charAt(0).toUpperCase() + occasion.slice(1);
}

function getStatusIcon(status) {
  switch(status) {
    case 'purchased': return '✔️';
    case 'rejected': return '❌';
    default: return '☐';
  }
}

// --- View Switching ---
function switchView(view) {
  currentView = view;
  localStorage.setItem('giftplan_currentView', view);
  
  // Update tab styling (desktop)
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Update mobile tab styling
  document.querySelectorAll('.mobile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Show/hide view containers
  document.getElementById('people-view').style.display = view === 'people' ? 'flex' : 'none';
  document.getElementById('yearplan-view').style.display = view === 'yearplan' ? 'flex' : 'none';
  
  // Load data for the view
  if (view === 'yearplan') {
    loadYearPlanData();
  }
  
  // Update mobile layout
  updateMobilePeopleViewLayout();
  
  console.log('[GiftPlan] Switched to view:', view);
}
window.switchView = switchView;

// --- Archived Section Toggle ---
function toggleArchivedSection() {
  showArchivedPeople = !showArchivedPeople;
  
  const btn = document.getElementById('toggle-archived-btn');
  const list = document.getElementById('archived-people-list');
  
  if (showArchivedPeople) {
    btn.classList.add('expanded');
    list.style.display = 'block';
    renderArchivedPeopleList();
  } else {
    btn.classList.remove('expanded');
    list.style.display = 'none';
  }
}
window.toggleArchivedSection = toggleArchivedSection;

// --- Update Archived Count Badge ---
function updateArchivedCount() {
  const countEl = document.getElementById('archived-count');
  if (countEl) {
    countEl.textContent = archivedPeople.length > 0 ? archivedPeople.length : '';
  }
}

// --- Year Filter Toggle (People View) ---
function handleYearFilterChange() {
  const checkbox = document.getElementById('show-all-years-toggle');
  showAllYears = checkbox.checked;
  localStorage.setItem('giftplan_showAllYears', showAllYears);
  
  const label = document.querySelector('.current-year-label');
  if (label) {
    label.textContent = showAllYears ? '(Showing: All Years)' : '(Currently: This Year Only)';
  }
  
  renderGiftIdeas();
}
window.handleYearFilterChange = handleYearFilterChange;

// --- Year Plan Year Change ---
function handleYearPlanYearChange() {
  const select = document.getElementById('yearplan-year-select');
  yearPlanYear = parseInt(select.value, 10);
  localStorage.setItem('giftplan_yearPlanYear', yearPlanYear);
  console.log('[GiftPlan] Year Plan year changed to:', yearPlanYear);
  loadYearPlanData();
}
window.handleYearPlanYearChange = handleYearPlanYearChange;

// --- Fetch Data ---
async function fetchAllPeopleData() {
  console.log('[GiftPlan] Fetching all people...');
  try {
    const { data, error } = await supabaseClient
      .from('people')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('[GiftPlan] Error fetching people:', error);
      return { all: [], active: [], archived: [] };
    }
    
    const all = data || [];
    const active = all.filter(p => !p.archived);
    const archived = all.filter(p => p.archived);
    
    console.log('[GiftPlan] People fetched - Active:', active.length, 'Archived:', archived.length);
    return { all, active, archived };
  } catch (err) {
    console.error('[GiftPlan] Exception fetching people:', err);
    return { all: [], active: [], archived: [] };
  }
}

async function fetchAllGiftsForPerson(personId) {
  console.log('[GiftPlan] Fetching all gifts for person:', personId);
  try {
    const { data, error } = await supabaseClient
      .from('gifts')
      .select('*')
      .eq('person_id', personId)
      .order('year', { ascending: false, nullsFirst: true });
    
    if (error) {
      console.error('[GiftPlan] Error fetching gifts:', error);
      return [];
    }
    
    console.log('[GiftPlan] Gifts found:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[GiftPlan] Exception fetching gifts:', err);
    return [];
  }
}

async function fetchGiftsForYear(year) {
  console.log('[GiftPlan] Fetching gifts for year:', year);
  try {
    const { data, error } = await supabaseClient
      .from('gifts')
      .select('*')
      .eq('year', year);
    
    if (error) {
      console.error('[GiftPlan] Error fetching gifts for year:', error);
      return [];
    }
    
    console.log('[GiftPlan] Gifts found for year:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[GiftPlan] Exception fetching gifts for year:', err);
    return [];
  }
}

// --- Filter gifts by year toggle ---
function filterGiftsByYear(gifts, showAllYears, currentYear) {
  if (showAllYears) return gifts;
  return gifts.filter(g => g.year === null || g.year === currentYear);
}

// --- Group gifts by year ---
function groupGiftsByYear(gifts) {
  const groups = {
    anytime: [],
    byYear: {}
  };
  
  gifts.forEach(gift => {
    if (gift.year === null || gift.year === undefined) {
      groups.anytime.push(gift);
    } else {
      if (!groups.byYear[gift.year]) {
        groups.byYear[gift.year] = [];
      }
      groups.byYear[gift.year].push(gift);
    }
  });
  
  return groups;
}

// --- Group gifts by person ---
function groupGiftsByPerson(gifts) {
  const grouped = {};
  gifts.forEach(gift => {
    const person = allPeopleList.find(p => p.id === gift.person_id);
    if (!person) return;
    if (!grouped[gift.person_id]) {
      grouped[gift.person_id] = {
        person: person,
        gifts: []
      };
    }
    grouped[gift.person_id].gifts.push(gift);
  });
  return grouped;
}

// --- Archive Toggle ---
async function toggleArchive(personId) {
  console.log('[GiftPlan] Toggling archive for person:', personId);
  try {
    const { data: person, error: fetchError } = await supabaseClient
      .from('people')
      .select('archived')
      .eq('id', personId)
      .single();
    
    if (fetchError) {
      console.error('[GiftPlan] Error fetching person:', fetchError);
      return;
    }
    
    const newArchived = !person.archived;
    
    const { error } = await supabaseClient
      .from('people')
      .update({ archived: newArchived })
      .eq('id', personId);
    
    if (error) {
      console.error('[GiftPlan] Error toggling archive:', error);
      return;
    }
    
    if (newArchived && selectedPersonId === personId) {
      selectedPersonId = null;
      allGiftsForPerson = [];
    }
    
    await loadData();
  } catch (err) {
    console.error('[GiftPlan] Exception toggling archive:', err);
  }
}
window.toggleArchive = toggleArchive;

// --- Main Data Loader (People View) ---
async function loadData() {
  console.log('[GiftPlan] Loading data...');
  
  const people = await fetchAllPeopleData();
  allPeopleList = people.all;
  allPeople = people.active;
  archivedPeople = people.archived;
  
  renderPeopleList();
  updateArchivedCount();
  updateMobilePeopleSelectedState();
  
  if (showArchivedPeople) {
    renderArchivedPeopleList();
  }
  
  if (selectedPersonId) {
    allGiftsForPerson = await fetchAllGiftsForPerson(selectedPersonId);
  } else {
    allGiftsForPerson = [];
  }
  
  renderGiftIdeas();
  renderGiftsGiven();
  renderGiftsReceived();
  renderStatsOnly();
  
  console.log('[GiftPlan] Data loaded. People:', allPeople.length, 'Archived:', archivedPeople.length);
}

// --- Year Plan Data Loader ---
async function loadYearPlanData() {
  console.log('[GiftPlan] Loading Year Plan data for year:', yearPlanYear);
  
  // Ensure people list is loaded
  if (allPeopleList.length === 0) {
    const people = await fetchAllPeopleData();
    allPeopleList = people.all;
    allPeople = people.active;
    archivedPeople = people.archived;
  }
  
  // Populate year selector
  populateYearPlanYearSelector();
  
  // Fetch gifts for year
  yearPlanGifts = await fetchGiftsForYear(yearPlanYear);
  
  // Render Year Plan
  renderYearPlanView();
}

// --- Populate Year Plan Year Selector ---
function populateYearPlanYearSelector() {
  const select = document.getElementById('yearplan-year-select');
  if (!select) return;
  
  const now = new Date().getFullYear();
  const years = [now - 1, now, now + 1, now + 2];
  
  // Preserve current selection or default to current year
  const currentVal = select.value ? parseInt(select.value, 10) : yearPlanYear;
  
  select.innerHTML = years.map(y => 
    `<option value="${y}" ${y === currentVal ? 'selected' : ''}>${y}</option>`
  ).join('');
}

// --- Render Functions ---
function renderPeopleList() {
  const ul = document.getElementById('people-list');
  if (!ul) return;
  ul.innerHTML = '';
  
  if (allPeople.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'No people added yet. Click + to add someone.';
    ul.appendChild(emptyLi);
    return;
  }

  allPeople.forEach(person => {
    const li = document.createElement('li');
    li.className = person.id === selectedPersonId ? 'selected' : '';
    li.onclick = (e) => {
      if (e.target.closest('.person-actions')) return;
      selectPerson(person.id);
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'person-name';
    nameSpan.textContent = person.name;
    nameSpan.title = person.birthday ? `Birthday: ${person.birthday}` : '';
    li.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'person-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '&#8942;'; // vertical ellipsis (triple dot menu)
    editBtn.title = 'Person Menu';
    editBtn.onclick = (e) => { e.stopPropagation(); openPersonSummaryModal(person); };
    actions.appendChild(editBtn);

    li.appendChild(actions);
    ul.appendChild(li);
  });
  updateMobilePeopleViewLayout();
  updateMobilePeopleSelectedState();
}

function renderArchivedPeopleList() {
  const ul = document.getElementById('archived-people-list');
  if (!ul) return;
  ul.innerHTML = '';
  
  if (archivedPeople.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'No archived people.';
    ul.appendChild(emptyLi);
    return;
  }
  
  archivedPeople.forEach(person => {
    const li = document.createElement('li');
    li.className = person.id === selectedPersonId ? 'selected' : '';
    li.onclick = (e) => {
      if (e.target.closest('.person-actions')) return;
      selectPerson(person.id);
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'person-name';
    nameSpan.innerHTML = `${person.name} <span class="person-archived-label">(archived)</span>`;
    li.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'person-actions';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'edit-btn';
    menuBtn.innerHTML = '&#8942;'; // vertical ellipsis (triple dot menu)
    menuBtn.title = 'Person Menu';
    menuBtn.onclick = (e) => { e.stopPropagation(); openPersonSummaryModal(person); };
    actions.appendChild(menuBtn);

    li.appendChild(actions);
    ul.appendChild(li);
  });
}

function renderGiftIdeas() {
  const container = document.getElementById('gift-boxes-container');
  const titleEl = document.getElementById('selected-person-name');
  const totalEl = document.getElementById('gift-plan-total');
  const birthdayId = 'selected-person-birthday-label';
  let birthdayLabel = document.getElementById(birthdayId);
  if (birthdayLabel) birthdayLabel.remove();

  if (!container) return;
  container.innerHTML = '';

  if (!selectedPersonId) {
    if (titleEl) titleEl.textContent = 'Select a Person';
    if (totalEl) totalEl.textContent = 'Potential: $0.00';
    container.innerHTML = `
      <div class="no-person-selected">
        <p>👈 Select a person from the list</p>
        <p>to view and manage their gift ideas</p>
      </div>
    `;
    return;
  }

  const person = allPeopleList.find(p => p.id === selectedPersonId);
  if (titleEl) titleEl.textContent = person?.name || 'Unknown';

  // Birthday label (if present)
  if (person && person.birthday) {
    birthdayLabel = document.createElement('div');
    birthdayLabel.id = birthdayId;
    birthdayLabel.className = 'person-birthday-label';
    birthdayLabel.textContent = `🎂 Birthday: ${person.birthday}`;
    // Insert after the name in the header
    const planTitle = document.getElementById('gift-plan-title');
    if (planTitle && planTitle.parentNode) {
      planTitle.parentNode.insertBefore(birthdayLabel, planTitle.nextSibling);
    }
  }

  // Filter to only show 'idea' type gifts
  const ideaGifts = allGiftsForPerson.filter(g => g.type === 'idea');
  const filteredGifts = filterGiftsByYear(ideaGifts, showAllYears, currentYear);

  // Calculate potential cost (sum of all idea costs)
  const potentialCost = filteredGifts.reduce((sum, g) => sum + (+g.cost || 0), 0);
  if (totalEl) totalEl.textContent = `Potential: ${formatCurrency(potentialCost)}`;

  if (filteredGifts.length === 0) {
    container.innerHTML = `
      <div class="empty-gifts-state">
        <p>No gift ideas yet for ${person?.name || 'this person'}.</p>
        <p>Click the + button above to add a gift idea!</p>
      </div>
    `;
    return;
  }

  const grouped = groupGiftsByYear(filteredGifts);

  if (grouped.anytime.length > 0) {
    const section = createYearSection('💡 IDEAS (ANYTIME)', grouped.anytime);
    container.appendChild(section);
  }
  
  const years = Object.keys(grouped.byYear).sort((a, b) => b - a);
  years.forEach(year => {
    const gifts = grouped.byYear[year];
    const section = createYearSection(`📅 ${year} Ideas`, gifts);
    container.appendChild(section);
  });
}

function createYearSection(title, gifts) {
  const section = document.createElement('div');
  section.className = 'year-section';

  const header = document.createElement('div');
  header.className = 'year-section-header';
  header.innerHTML = `<span class="year-toggle">▼</span> ${title} <span class="year-section-count">(${gifts.length})</span>`;
  section.appendChild(header);

  const content = document.createElement('div');
  content.className = 'year-section-content';
  gifts.forEach(gift => {
    const box = createGiftBox(gift, false);
    content.appendChild(box);
  });
  section.appendChild(content);

  header.addEventListener('click', () => {
    const isCollapsed = content.classList.toggle('collapsed');
    const toggle = header.querySelector('.year-toggle');
    if (toggle) toggle.textContent = isCollapsed ? '▶' : '▼';
  });

  return section;
}

function createGiftBox(gift, showPersonName = false, isReceived = false) {
  const box = document.createElement('div');
  box.className = `gift-box priority-${gift.priority || 'none'}${isReceived ? ' received' : ''}`;
  box.className = `gift-box priority-${gift.priority || 'none'}${isReceived ? ' received' : ''}`;
  
  // Header with title and actions on the same line
  const header = document.createElement('div');
  header.className = 'gift-box-header';


  const itemSpan = document.createElement('strong');
  itemSpan.textContent = gift.item || '(No item)';
  header.appendChild(itemSpan);

  // Occasion label (if set)
  if (gift.occasion) {
    const occasionSpan = document.createElement('span');
    occasionSpan.className = 'gift-occasion';
    occasionSpan.textContent = ` (${capitalizeOccasion(gift.occasion)})`;
    header.appendChild(occasionSpan);
  }

  // Actions row (moved to header)
  const actions = document.createElement('div');
  actions.className = 'gift-box-actions';

  if (!isReceived) {
        // Copy to Grocery button
        const copyToGroceryBtn = document.createElement('button');
        copyToGroceryBtn.className = 'copy-to-grocery-btn';
        copyToGroceryBtn.title = 'Copy to Grocery List';
        copyToGroceryBtn.innerHTML = '🛒';
        copyToGroceryBtn.onclick = async (e) => {
          e.stopPropagation();
          await copyGiftToGrocery(gift);
        };
        actions.appendChild(copyToGroceryBtn);
        // Indicator if already in groceries (async)
        const groceryIndicator = document.createElement('span');
        groceryIndicator.className = 'gift-grocery-indicator';
        groceryIndicator.style.display = 'none';
        actions.appendChild(groceryIndicator);
        isGiftInGroceries(gift).then(inGroceries => {
          if (inGroceries) {
            groceryIndicator.title = 'Also in Grocery List';
            groceryIndicator.innerHTML = '🛒✔️';
            groceryIndicator.style.display = '';
          } else {
            groceryIndicator.style.display = 'none';
          }
        });
    // Helper: Copy gift to grocery list (Active section)
    async function copyGiftToGrocery(gift) {
      // Get current user
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        alert('You must be logged in to copy to groceries.');
        return;
      }
      // Insert grocery item
      // Only allow valid priorities: 'high', 'medium', 'low', or null
      let validPriority = null;
      if (gift.priority === 'high' || gift.priority === 'medium' || gift.priority === 'low') {
        validPriority = gift.priority;
      }
      const itemData = {
        name: gift.item,
        type: 'food', // Default type, or map from gift if desired
        description: gift.notes || null,
        priority: validPriority,
        labels: 'from-giftplan',
        due_date: null,
        link: null,
        store: gift.store || null,
        checked: false,
        section: 'Active',
        user_id: user.id
      };
      // Prevent duplicate
      if (await isGiftInGroceries(gift)) {
        alert('This gift is already in your grocery list.');
        return;
      }
      const { error } = await supabaseClient
        .from('grocery_items')
        .insert([itemData]);
      if (error) {
        console.error('Supabase insert error:', error);
        alert('Failed to copy to grocery list. ' + (error.message || error));
        return;
      }
      alert('Copied to grocery list!');
    }

    // Helper: Check if gift is already in groceries (by name, case-insensitive)
    async function isGiftInGroceries(gift) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabaseClient
        .from('grocery_items')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', gift.item);
      if (error) return false;
      return data && data.length > 0;
    }
    // Year dropdown
    const now = new Date().getFullYear();
    const years = [now - 1, now, now + 1, now + 2];
    const yearSelect = document.createElement('select');
    yearSelect.className = 'year-btn';
    yearSelect.title = 'Change Year';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Any';
    if (!gift.year) placeholderOption.selected = true;
    yearSelect.appendChild(placeholderOption);
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (gift.year == y) opt.selected = true;
      yearSelect.appendChild(opt);
    });
    yearSelect.onchange = async function() {
      const newYear = this.value ? parseInt(this.value, 10) : null;
      if (newYear !== gift.year) {
        // Update year in backend and UI
        try {
          const { error } = await supabaseClient
            .from('gifts')
            .update({ year: newYear })
            .eq('id', gift.id);
          if (!error) {
            gift.year = newYear;
            // Optionally re-render the list or just update UI
            renderGiftIdeas();
          }
        } catch (e) { console.error('Failed to update year', e); }
      }
    };
    actions.appendChild(yearSelect);

    // Promote to Given button (only for idea-type gifts)
    if (gift.type === 'idea') {
      const promoteBtn = document.createElement('button');
      promoteBtn.className = 'promote-btn';
      promoteBtn.innerHTML = '🎁';
      promoteBtn.title = 'Convert to Given Gift';
      promoteBtn.onclick = () => promoteIdeaToGiven(gift.id);
      actions.appendChild(promoteBtn);
    }

    // Triple dot menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'gift-menu-btn';
    menuBtn.innerHTML = '&#8942;'; // vertical ellipsis
    menuBtn.title = 'Gift Actions';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      openGiftActionModal(gift);
    };
    actions.appendChild(menuBtn);
  }

  header.appendChild(actions);
  box.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'gift-box-body';

  // Cost + Store (only for given gifts)
  if (!isReceived && (gift.store || gift.cost)) {
    const storeCost = document.createElement('div');
    storeCost.className = 'gift-box-store-cost';
    const parts = [];
    if (gift.cost) parts.push(`<span class="gift-cost">${formatCurrency(gift.cost)}</span>`);
    if (gift.store) {
      let storeText = gift.store;
      let truncated = false;
      if (window.innerWidth <= 768 && storeText.length > 16) {
        storeText = storeText.slice(0, 14) + '…';
        truncated = true;
      }
      const storeSpan = document.createElement('span');
      storeSpan.className = 'gift-store';
      storeSpan.textContent = storeText;
      if (truncated) {
        storeSpan.title = gift.store;
        storeSpan.style.cursor = 'pointer';
        storeSpan.onclick = function(e) {
          e.stopPropagation();
          if (storeSpan.textContent.endsWith('…')) {
            storeSpan.textContent = gift.store;
          } else {
            storeSpan.textContent = storeText;
          }
        };
      }
      parts.push(storeSpan.outerHTML);
    }
    storeCost.innerHTML = parts.join(' - ');
    body.appendChild(storeCost);
  }
  
  // (actions already handled above)
  
  // ...priority selector removed from gift box view...
  
  // Notes
  if (gift.notes) {
    const notes = document.createElement('div');
    notes.className = 'gift-box-notes';
    let notesText = gift.notes;
    let truncated = false;
    if (window.innerWidth <= 768 && notesText.length > 20) {
      notesText = notesText.slice(0, 18) + '…';
      truncated = true;
    }
    notes.textContent = notesText;
    if (truncated) {
      notes.title = gift.notes;
      notes.style.cursor = 'pointer';
      notes.onclick = function(e) {
        e.stopPropagation();
        if (notes.textContent.endsWith('…')) {
          notes.textContent = gift.notes;
        } else {
          notes.textContent = notesText;
        }
      };
    }
    body.appendChild(notes);
  }
  
  box.appendChild(body);
  return box;
}

// --- Year Plan View Rendering ---
function renderYearPlanView() {
  const givenList = document.getElementById('yearplan-given-list');
  const receivedList = document.getElementById('yearplan-received-list');
  
  if (!givenList || !receivedList) return;
  
  // Split gifts
  const givenGifts = yearPlanGifts.filter(g => g.type === 'given');
  const receivedGifts = yearPlanGifts.filter(g => g.type === 'received');
  
  // Group by person
  const givenByPerson = groupGiftsByPerson(givenGifts);
  const receivedByPerson = groupGiftsByPerson(receivedGifts);
  
  // Render Given column
  renderYearPlanColumn(givenList, givenByPerson, false);
  
  // Render Received column
  renderYearPlanColumn(receivedList, receivedByPerson, true);
  
  // Update totals
  updateYearPlanTotals(givenGifts);
}

function renderYearPlanColumn(container, groupedByPerson, isReceived) {
  container.innerHTML = '';
  
  const personIds = Object.keys(groupedByPerson);
  
  if (personIds.length === 0) {
    container.innerHTML = `
      <div class="yearplan-empty">
        <p>No ${isReceived ? 'received' : ''} gifts for ${yearPlanYear} yet.</p>
        <p>Click + to add one!</p>
      </div>
    `;
    return;
  }
  
  // Sort by person name
  personIds.sort((a, b) => {
    const nameA = groupedByPerson[a].person.name.toLowerCase();
    const nameB = groupedByPerson[b].person.name.toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  personIds.forEach(personId => {
    const { person, gifts } = groupedByPerson[personId];
    
    const group = document.createElement('div');
    group.className = 'person-group';
    
    // Person header with clickable link
    const header = document.createElement('div');
    header.className = 'person-group-header';
    
    const link = createPersonLink(person.id, person.name, person.archived);
    header.appendChild(link);
    
    if (person.archived) {
      const archivedTag = document.createElement('span');
      archivedTag.className = 'person-archived-tag';
      archivedTag.textContent = '(archived)';
      header.appendChild(archivedTag);
    }
    
    const countSpan = document.createElement('span');
    countSpan.className = 'person-gift-count';
    countSpan.textContent = `${gifts.length} gift${gifts.length !== 1 ? 's' : ''}`;
    header.appendChild(countSpan);
    
    group.appendChild(header);
    
    // Gift boxes
    gifts.forEach(async gift => {
      const box = createGiftBox(gift, true, isReceived);
      group.appendChild(box);
    });
    
    container.appendChild(group);
  });
}

function createPersonLink(personId, personName, isArchived) {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = personName;
  link.className = 'person-link';
  link.onclick = (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      switchView('people');
      setTimeout(() => selectPerson(personId), 10);
    } else {
      switchView('people');
      selectPerson(personId);
    }
  };
  return link;
}

function updateYearPlanTotals(givenGifts) {
  // Sum all given gifts (no longer filtering by status)
  const totalSpent = givenGifts.reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  // Header total
  const spentEl = document.getElementById('yearplan-spent');
  if (spentEl) spentEl.textContent = `Total Spent: ${formatCurrency(totalSpent)}`;
  
  // Column total
  const givenSpentEl = document.getElementById('yearplan-given-spent');
  if (givenSpentEl) givenSpentEl.textContent = `Spent: ${formatCurrency(totalSpent)}`;
}

// --- Event Handlers ---
function selectPerson(personId) {
  console.log('[GiftPlan] Selected person:', personId);
  selectedPersonId = personId;
  localStorage.setItem('giftplan_selectedPersonId', personId || '');
  
  // Reset history years shown when switching people
  historyYearsShown = 5;
  collapsedYears.clear();
  
  renderPeopleList();
  if (showArchivedPeople) {
    renderArchivedPeopleList();
  }
  
  loadGiftsForSelectedPerson();
  updateMobilePeopleViewLayout();
  updateMobilePeopleSelectedState();
}

async function loadGiftsForSelectedPerson() {
  if (selectedPersonId) {
    allGiftsForPerson = await fetchAllGiftsForPerson(selectedPersonId);
  } else {
    allGiftsForPerson = [];
  }
  renderGiftIdeas();
  renderGiftsGiven();
  renderGiftsReceived();
  renderStatsOnly();
  renderHistory(allGiftsForPerson);
  updateMobilePeopleViewLayout();
  updateMobilePeopleSelectedState();
}

// --- Stats & History Functions ---
function calculateStats(personGifts) {
  const now = new Date();
  const currentYr = now.getFullYear();
  const lastYear = currentYr - 1;
  
  // Last year counts (all gifts, not just purchased)
  const lastYearGiven = personGifts.filter(g => 
    g.type === 'given' && g.year === lastYear
  ).length;
  const lastYearReceived = personGifts.filter(g => 
    g.type === 'received' && g.year === lastYear
  ).length;
  
  // All time counts (all gifts, not just purchased)
  const allGiven = personGifts.filter(g => g.type === 'given').length;
  const allReceived = personGifts.filter(g => g.type === 'received').length;
  
  // Money totals (only purchased)
  const lastYearSpent = personGifts
    .filter(g => g.type === 'given' && g.year === lastYear && g.status === 'purchased')
    .reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  const totalSpent = personGifts
    .filter(g => g.type === 'given' && g.status === 'purchased')
    .reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  return {
    lastYear,
    lastYearGiven,
    lastYearReceived,
    allGiven,
    allReceived,
    lastYearSpent,
    totalSpent
  };
}

function renderStats(stats) {
  const container = document.getElementById('stats-container');
  if (!container) return;
  
  if (!selectedPersonId) {
    container.innerHTML = '';
    return;
  }
  
  const statsHTML = `
    <div class="stats-summary">
      <div class="stats-title">📊 SUMMARY</div>
      <div class="stats-row">
        <span>${stats.lastYear}: 
          <span class="stat-given">Given: ${stats.lastYearGiven}</span> 
          <span class="stat-received">Received: ${stats.lastYearReceived}</span>
        </span>
        <span class="stat-divider">|</span>
        <span>All: 
          <span class="stat-given">Given: ${stats.allGiven}</span> 
          <span class="stat-received">Received: ${stats.allReceived}</span>
        </span>
      </div>
      <div class="stats-row">
        <span class="stat-money">${formatCurrency(stats.lastYearSpent)} (${stats.lastYear})</span>
        <span class="stat-divider">|</span>
        <span class="stat-money">${formatCurrency(stats.totalSpent)} (total)</span>
      </div>
    </div>
  `;
  
  container.innerHTML = statsHTML;
}

function getOccasionIcon(occasion) {
  const icons = {
    'christmas': '🎄',
    'birthday': '🎂',
    'valentines': '💕',
    'anniversary': '💍',
    'mothersday': '🌷',
    'fathersday': '👔',
    'easter': '🐣',
    'graduation': '🎓',
    'other': '🎁'
  };
  return icons[occasion?.toLowerCase()] || '🎁';
}

function buildHistoryColumn(gifts, years, type) {
  if (years.length === 0) {
    return `<div class="history-col-empty">No ${type === 'given' ? 'gifts given' : 'gifts received'} yet</div>`;
  }
  
  let html = '<div class="history-timeline">';
  let hasAnyGifts = false;
  
  years.forEach(year => {
    const yearGifts = gifts.filter(g => g.year === year && g.type === type);
    if (yearGifts.length === 0) return;
    hasAnyGifts = true;
    const isCollapsed = collapsedYears.has(`${type}-${year}`);
    html += `
      <div class="history-year" data-year="${year}" data-type="${type}">
        <div class="history-year-header" onclick="toggleHistoryYear(${year}, '${type}')">
          📅 ${year} <span class="year-toggle">${isCollapsed ? '▶' : '▼'}</span>
        </div>
        <div class="history-year-content${isCollapsed ? ' collapsed' : ''}">
    `;
    yearGifts.forEach(gift => {
      const occasionIcon = getOccasionIcon(gift.occasion);
      const costDisplay = type === 'given' && gift.cost ? `<span class="history-cost">${formatCurrency(gift.cost)}</span>` : '';
      html += `
        <div class="history-item">
          <span class="history-item-text">${gift.item || '(No item)'}</span>
          <span class="history-occasion">${occasionIcon}</span>
          ${costDisplay}
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  if (!hasAnyGifts) {
    return `<div class="history-col-empty">No ${type === 'given' ? 'purchased gifts' : 'gifts received'} yet</div>`;
  }
  
  return html;
}

function renderHistory(personGifts) {
  const container = document.getElementById('history-container');
  if (!container) return;
  
  if (!selectedPersonId) {
    container.innerHTML = '';
    return;
  }
  
  // Filter to only gifts with a year assigned
  const giftsWithYear = personGifts.filter(g => g.year !== null && g.year !== undefined);
  
  // Get all years with data, sorted descending
  const years = [...new Set(giftsWithYear.map(g => g.year))].sort((a, b) => b - a);
  
  // Show only first N years
  const yearsToShow = years.slice(0, historyYearsShown);
  
  const given = buildHistoryColumn(giftsWithYear, yearsToShow, 'given');
  const received = buildHistoryColumn(giftsWithYear, yearsToShow, 'received');
  
  const viewMoreBtn = years.length > historyYearsShown 
    ? `<button id="view-more-history" class="view-more-btn" onclick="loadMoreHistory()">View More (${Math.min(5, years.length - historyYearsShown)} more years)</button>` 
    : '';
  
  const historyHTML = `
    <div class="history-section">
      <div class="history-title">📜 HISTORY</div>
      <div class="history-columns">
        <div class="history-col">
          <div class="history-col-header">GIVEN</div>
          ${given}
        </div>
        <div class="history-col">
          <div class="history-col-header">RECEIVED</div>
          ${received}
        </div>
      </div>
      ${viewMoreBtn}
    </div>
  `;
  
  container.innerHTML = historyHTML;
}

// --- Render Given/Received Columns ---
function renderGiftsGiven() {
  const container = document.getElementById('gifts-given-list');
  const totalEl = document.getElementById('gifts-given-total');
  
  if (!container) return;
  container.innerHTML = '';
  
  if (!selectedPersonId) {
    container.innerHTML = '<div class="gift-column-empty">Select a person to view given gifts</div>';
    if (totalEl) totalEl.textContent = 'Total Spent: $0.00';
    return;
  }
  
  // Filter to only 'given' type gifts
  const givenGifts = allGiftsForPerson.filter(g => g.type === 'given');
  
  // Calculate total spent
  const totalSpent = givenGifts.reduce((sum, g) => sum + (+g.cost || 0), 0);
  if (totalEl) totalEl.textContent = `Total Spent: ${formatCurrency(totalSpent)}`;
  
  if (givenGifts.length === 0) {
    container.innerHTML = '<div class="gift-column-empty">No gifts given yet</div>';
    return;
  }
  
  // Group by year
  const grouped = groupGiftsByYear(givenGifts);
  // Render anytime gifts first
  if (grouped.anytime.length > 0) {
    const section = createYearSection('💡 IDEAS (ANYTIME)', grouped.anytime);
    container.appendChild(section);
  }
  // Render by year (descending)
  const years = Object.keys(grouped.byYear).sort((a, b) => b - a);
  years.forEach(year => {
    const gifts = grouped.byYear[year];
    const section = createYearSection(`📅 ${year} Gifts`, gifts);
    container.appendChild(section);
  });
  // (Removed duplicate/erroneous block)
}

function renderGiftsReceived() {
  const container = document.getElementById('gifts-received-list');
  
  if (!container) return;
  container.innerHTML = '';
  
  if (!selectedPersonId) {
    container.innerHTML = '<div class="gift-column-empty">Select a person to view received gifts</div>';
    return;
  }
  
  // Filter to only 'received' type gifts
  const receivedGifts = allGiftsForPerson.filter(g => g.type === 'received');
  
  if (receivedGifts.length === 0) {
    container.innerHTML = '<div class="gift-column-empty">No gifts received yet</div>';
    return;
  }
  
  // Group by year
  const grouped = groupGiftsByYear(receivedGifts);
  
  // Render anytime gifts first
  if (grouped.anytime.length > 0) {
    const section = createGiftColumnSection('No Year', grouped.anytime, true, true);
    container.appendChild(section);
  }
  // Render by year (descending)
  const years = Object.keys(grouped.byYear).sort((a, b) => b - a);
  years.forEach(year => {
    const gifts = grouped.byYear[year];
    const section = createGiftColumnSection(year, gifts, true, false);
    container.appendChild(section);
  });
}

function createGiftColumnSection(title, gifts, isReceived, isAnytime) {
  // Collapsible for years, not for 'No Year'
  const section = document.createElement('div');
  section.className = isAnytime ? 'year-section anytime-section' : 'year-section';
  if (isAnytime) {
    // Not collapsible
    const header = document.createElement('div');
    header.className = 'year-section-header';
    header.innerHTML = `📅 ${title} <span class="year-section-count">(${gifts.length})</span>`;
    section.appendChild(header);
    gifts.forEach(gift => {
      const box = createGiftColumnBox(gift, isReceived);
      section.appendChild(box);
    });
    return section;
  }
  // Collapsible year section
  const yearKey = `${isReceived ? 'received' : 'given'}-${title}`;
  const isCollapsed = collapsedYears.has(yearKey);
  const header = document.createElement('div');
  header.className = 'year-section-header';
  header.innerHTML = `<span class="year-toggle">${isCollapsed ? '▶' : '▼'}</span> 📅 ${title} <span class="year-section-count">(${gifts.length})</span>`;
  header.style.cursor = 'pointer';
  header.onclick = function() {
    if (collapsedYears.has(yearKey)) {
      collapsedYears.delete(yearKey);
    } else {
      collapsedYears.add(yearKey);
    }
    if (isReceived) {
      renderGiftsReceived();
    } else {
      renderGiftsGiven();
    }
  };
  section.appendChild(header);
  const content = document.createElement('div');
  content.className = 'year-section-content' + (isCollapsed ? ' collapsed' : '');
  if (!isCollapsed) {
    gifts.forEach(gift => {
      const box = createGiftColumnBox(gift, isReceived);
      content.appendChild(box);
    });
  }
  section.appendChild(content);
  return section;
}

function createGiftColumnBox(gift, isReceived) {
  const box = document.createElement('div');
  box.className = `gift-box${isReceived ? ' received' : ''}`;
  
  // Header with item name, year dropdown, and menu button all on one line
  const header = document.createElement('div');
  header.className = 'gift-box-header';

  const itemSpan = document.createElement('strong');
  itemSpan.textContent = gift.item || '(No item)';
  header.appendChild(itemSpan);

  // Occasion label (if set)
  if (gift.occasion) {
    const occasionSpan = document.createElement('span');
    occasionSpan.className = 'gift-occasion';
    occasionSpan.textContent = ` (${capitalizeOccasion(gift.occasion)})`;
    header.appendChild(occasionSpan);
  }

  // Year dropdown
  const now = new Date().getFullYear();
  const years = [now - 1, now, now + 1, now + 2];
  const yearSelect = document.createElement('select');
  yearSelect.className = 'year-btn';
  yearSelect.title = 'Change Year';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = '[Year]';
  if (!gift.year) placeholderOption.selected = true;
  yearSelect.appendChild(placeholderOption);
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}`;
    if (gift.year == y) opt.selected = true;
    yearSelect.appendChild(opt);
  });
  yearSelect.onchange = async function() {
    const newYear = this.value ? parseInt(this.value, 10) : null;
    if (newYear !== gift.year) {
      try {
        const { error } = await supabaseClient
          .from('gifts')
          .update({ year: newYear })
          .eq('id', gift.id);
        if (!error) {
          gift.year = newYear;
          if (isReceived) {
            renderGiftsReceived();
          } else {
            renderGiftsGiven();
          }
        }
      } catch (e) { console.error('Failed to update year', e); }
    }
  };
  header.appendChild(yearSelect);

  // Triple dot menu button
  const menuBtn = document.createElement('button');
  menuBtn.className = 'gift-menu-btn';
  menuBtn.innerHTML = '&#8942;'; // vertical ellipsis
  menuBtn.title = 'Gift Actions';
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    openGiftActionModal(gift);
  };
  header.appendChild(menuBtn);

  box.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'gift-box-body';

  // Cost + Store (only for given gifts)
  if (!isReceived && (gift.store || gift.cost)) {
    const storeCost = document.createElement('div');
    storeCost.className = 'gift-box-store-cost';
    const parts = [];
    if (gift.cost) parts.push(`<span class="gift-cost">${formatCurrency(gift.cost)}</span>`);
    if (gift.store) parts.push(gift.store);
    storeCost.innerHTML = parts.join(' - ');
    body.appendChild(storeCost);
  }

  // Notes
  if (gift.notes) {
    const notes = document.createElement('div');
    notes.className = 'gift-box-notes';
    notes.textContent = gift.notes;
    body.appendChild(notes);
  }

  box.appendChild(body);
  return box;
}

// --- Modal openers for given/received ---
function openAddGivenGiftModal() {
  if (!selectedPersonId) {
    alert('Please select a person first.');
    return;
  }
  giftModalMode = 'add-given';
  editingGift = null;
  
  populateYearDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  document.getElementById('gift-modal-title').textContent = 'Add Given Gift';
  
  // Hide person selector (we know the person)
  document.getElementById('gift-person-row').style.display = 'none';
  
  // Show relevant fields
  document.getElementById('gift-store-row').style.display = 'block';
  document.getElementById('gift-cost-row').style.display = 'block';
  document.getElementById('gift-priority-row').style.display = 'none';
  document.getElementById('gift-type-row').style.display = 'none';
  document.getElementById('gift-modal-info').style.display = 'none';
  
  // Reset form
  document.getElementById('gift-form').reset();
  document.getElementById('gift-type').value = 'given';
  
  // Set form handler
  document.getElementById('gift-form').onsubmit = handleGiftFormSubmit;
}
window.openAddGivenGiftModal = openAddGivenGiftModal;

function openAddReceivedGiftModal() {
  if (!selectedPersonId) {
    alert('Please select a person first.');
    return;
  }
  giftModalMode = 'add-received';
  editingGift = null;
  
  populateYearDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  document.getElementById('gift-modal-title').textContent = 'Add Received Gift';
  
  // Hide person selector (we know the person)
  document.getElementById('gift-person-row').style.display = 'none';
  
  // Hide cost/store/priority for received gifts
  document.getElementById('gift-store-row').style.display = 'none';
  document.getElementById('gift-cost-row').style.display = 'none';
  document.getElementById('gift-priority-row').style.display = 'none';
  document.getElementById('gift-type-row').style.display = 'none';
  document.getElementById('gift-modal-info').style.display = 'none';
  
  // Reset form
  document.getElementById('gift-form').reset();
  document.getElementById('gift-type').value = 'received';
  
  // Set form handler
  document.getElementById('gift-form').onsubmit = handleGiftFormSubmit;
}
window.openAddReceivedGiftModal = openAddReceivedGiftModal;

// --- Render Stats Only (no history) ---
function renderStatsOnly() {
  const statsContainer = document.getElementById('stats-container');
  
  if (!selectedPersonId) {
    if (statsContainer) statsContainer.innerHTML = '<div class="stats-empty">Select a person to view stats</div>';
    return;
  }
  
  const stats = calculateStats(allGiftsForPerson);
  renderStats(stats);
}

function toggleHistoryYear(year, type) {
  const key = `${type}-${year}`;
  const yearEl = document.querySelector(`.history-year[data-year="${year}"][data-type="${type}"]`);
  if (!yearEl) return;
  
  const content = yearEl.querySelector('.history-year-content');
  const toggle = yearEl.querySelector('.year-toggle');
  
  if (collapsedYears.has(key)) {
    collapsedYears.delete(key);
    content.classList.remove('collapsed');
    toggle.textContent = '▼';
  } else {
    collapsedYears.add(key);
    content.classList.add('collapsed');
    toggle.textContent = '▶';
  }
}
window.toggleHistoryYear = toggleHistoryYear;

function loadMoreHistory() {
  historyYearsShown += 5;
  renderHistory(allGiftsForPerson);
}
window.loadMoreHistory = loadMoreHistory;

// --- Update Priority ---
async function updateGiftPriority(giftId, priority) {
  console.log('[GiftPlan] Updating priority:', giftId, '->', priority);
  try {
    const { error } = await supabaseClient
      .from('gifts')
      .update({ priority })
      .eq('id', giftId);
    
    if (error) {
      console.error('[GiftPlan] Error updating priority:', error);
      return;
    }
    
    // Update local state
    const gift = allGiftsForPerson.find(g => g.id === giftId);
    if (gift) gift.priority = priority;
    
    const yearGift = yearPlanGifts.find(g => g.id === giftId);
    if (yearGift) yearGift.priority = priority;
    
    // Re-render current view
    if (currentView === 'people') {
      renderGiftIdeas();
    } else {
      renderYearPlanView();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception updating priority:', err);
  }
}
window.updateGiftPriority = updateGiftPriority;

// --- Promote Idea to Given ---
async function promoteIdeaToGiven(giftId) {
  // Show a modal to ask for year and occasion
  const gift = allGiftsForPerson.find(g => g.id === giftId);
  if (!gift) return;

  // Create modal if not exists
  let promoteModal = document.getElementById('promote-gift-modal');
  if (!promoteModal) {
    promoteModal = document.createElement('div');
    promoteModal.id = 'promote-gift-modal';
    promoteModal.className = 'modal';
    promoteModal.innerHTML = `
      <h2>Promote Gift to "Given"</h2>
      <div style="margin-bottom:12px;">Assign a year and occasion for this gift:</div>
      <label for="promote-gift-year">Year</label>
      <select id="promote-gift-year"></select>
      <label for="promote-gift-occasion">Occasion</label>
      <select id="promote-gift-occasion">
        <option value="">Anytime</option>
        <option value="christmas">Christmas</option>
        <option value="birthday">Birthday</option>
        <option value="valentines">Valentine's Day</option>
        <option value="anniversary">Anniversary</option>
        <option value="mothersday">Mother's Day</option>
        <option value="fathersday">Father's Day</option>
        <option value="easter">Easter</option>
        <option value="graduation">Graduation</option>
        <option value="other">Other</option>
      </select>
      <div class="modal-actions">
        <button id="promote-gift-cancel" type="button">Cancel</button>
        <button id="promote-gift-confirm" type="button">Promote</button>
      </div>
    `;
    document.body.appendChild(promoteModal);
  }

  // Populate year dropdown
  const yearSelect = document.getElementById('promote-gift-year');
  yearSelect.innerHTML = '<option value="">Anytime (No Year)</option>';
  const now = new Date().getFullYear();
  [now - 1, now, now + 1, now + 2].forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (gift.year == y) opt.selected = true;
    yearSelect.appendChild(opt);
  });
  // Set current values if present
  yearSelect.value = gift.year || '';
  const occasionSelect = document.getElementById('promote-gift-occasion');
  occasionSelect.value = gift.occasion || '';

  // Show modal
  document.getElementById('modal-overlay').style.display = 'block';
  promoteModal.style.display = 'block';

  // Cancel handler
  document.getElementById('promote-gift-cancel').onclick = function() {
    promoteModal.style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
  };

  // Confirm handler
  document.getElementById('promote-gift-confirm').onclick = async function() {
    const newYear = yearSelect.value ? parseInt(yearSelect.value, 10) : null;
    const newOccasion = occasionSelect.value || '';
    try {
      const { error } = await supabaseClient
        .from('gifts')
        .update({ type: 'given', priority: null, year: newYear, occasion: newOccasion })
        .eq('id', giftId);
      if (error) {
        alert('Failed to promote gift.');
        console.error('[GiftPlan] Error promoting gift:', error);
        return;
      }
      // Update local state
      gift.type = 'given';
      gift.priority = null;
      gift.year = newYear;
      gift.occasion = newOccasion;
      const yearGift = yearPlanGifts.find(g => g.id === giftId);
      if (yearGift) {
        yearGift.type = 'given';
        yearGift.priority = null;
        yearGift.year = newYear;
        yearGift.occasion = newOccasion;
      }
      promoteModal.style.display = 'none';
      document.getElementById('modal-overlay').style.display = 'none';
      // Refresh views
      renderGiftIdeas();
      renderGiftsGiven();
      renderStatsOnly();
    } catch (err) {
      alert('Failed to promote gift.');
      console.error('[GiftPlan] Exception promoting gift:', err);
    }
  };
}
window.promoteIdeaToGiven = promoteIdeaToGiven;

// --- Delete ---
async function deleteGift(giftId) {
  if (!confirm('Delete this gift?')) return;
  console.log('[GiftPlan] Deleting gift:', giftId);
  try {
    const { error } = await supabaseClient
      .from('gifts')
      .delete()
      .eq('id', giftId);
    
    if (error) {
      console.error('[GiftPlan] Error deleting gift:', error);
      return;
    }
    
    allGiftsForPerson = allGiftsForPerson.filter(g => g.id !== giftId);
    yearPlanGifts = yearPlanGifts.filter(g => g.id !== giftId);
    
    if (currentView === 'people') {
      renderGiftIdeas();
      renderGiftsGiven();
      renderGiftsReceived();
      renderStatsOnly();
    } else {
      renderYearPlanView();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception deleting gift:', err);
  }
}

async function deletePerson(personId) {
  if (!confirm('Delete this person and all their gifts?')) return;
  console.log('[GiftPlan] Deleting person:', personId);
  try {
    await supabaseClient.from('gifts').delete().eq('person_id', personId);
    const { error } = await supabaseClient.from('people').delete().eq('id', personId);
    if (error) console.error('[GiftPlan] Error deleting person:', error);
    
    if (selectedPersonId === personId) {
      selectedPersonId = null;
      allGiftsForPerson = [];
    }
    
    await loadData();
    if (currentView === 'yearplan') {
      await loadYearPlanData();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception deleting person:', err);
  }
}

// --- Initialize event listeners ---
function initEventListeners() {
  const addPersonBtn = document.getElementById('add-person-btn');
  if (addPersonBtn) {
    addPersonBtn.onclick = () => openPersonModal();
  }
  
  const personForm = document.getElementById('person-form');
  if (personForm) {
    personForm.onsubmit = handlePersonFormSubmit;
  }
  
  const addGiftBtn = document.getElementById('add-gift-btn');
  if (addGiftBtn) {
    addGiftBtn.onclick = () => {
      if (!selectedPersonId) {
        alert('Please select a person first.');
        return;
      }
      openGiftModalForPerson();
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

// --- Person Summary Modal ---
function openPersonSummaryModal(person) {
  editingPerson = person;
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('person-summary-modal').style.display = 'block';
  document.getElementById('person-summary-title').textContent = person.name + ' Summary';
  // Info summary
  let infoHtml = '';
  infoHtml += `<div><strong>Name:</strong> <span id="person-summary-name">${person.name}</span></div>`;
  infoHtml += `<div><strong>Birthday:</strong> <span id="person-summary-birthday">${person.birthday ? person.birthday : '<span style=\"color:#888\">(none)</span>'}</span></div>`;
  // Calculate stats for this person
  const stats = calculateStats(allGiftsForPerson);
  infoHtml += `<div><strong>Total Gifts Given:</strong> ${stats.allGiven}</div>`;
  infoHtml += `<div><strong>Total Gifts Received:</strong> ${stats.allReceived}</div>`;
  infoHtml += `<div><strong>Notes:</strong> <span id="person-summary-notes">${person.notes ? person.notes.replace(/\n/g, '<br>') : '<span style=\"color:#888\">(none)</span>'}</span></div>`;
  document.getElementById('person-summary-info').innerHTML = infoHtml;
  // Hide edit fields and show summary
  document.getElementById('person-summary-edit-fields').style.display = 'none';
  document.getElementById('edit-person-btn').style.display = '';
  document.getElementById('save-person-edit-btn').style.display = 'none';
  document.getElementById('cancel-person-edit-btn').style.display = 'none';
  // Archive/Unarchive/Delete button logic
  const archiveBtn = document.getElementById('archive-person-btn');
  const unarchiveBtn = document.getElementById('unarchive-person-btn');
  const deleteBtn = document.getElementById('delete-person-btn');
  if (person.archived) {
    archiveBtn.style.display = 'none';
    unarchiveBtn.style.display = '';
  } else {
    archiveBtn.style.display = '';
    unarchiveBtn.style.display = 'none';
  }
  archiveBtn.onclick = function() { toggleArchive(person.id); closePersonSummaryModal(); };
  unarchiveBtn.onclick = function() { toggleArchive(person.id); closePersonSummaryModal(); };
  deleteBtn.onclick = function() { deletePerson(person.id); closePersonSummaryModal(); };
}

function closePersonSummaryModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('person-summary-modal').style.display = 'none';
  editingPerson = null;
}
window.closePersonSummaryModal = closePersonSummaryModal;

// Save notes
document.addEventListener('DOMContentLoaded', function() {
  // Edit button logic
  const editBtn = document.getElementById('edit-person-btn');
  const saveBtn = document.getElementById('save-person-edit-btn');
  const cancelBtn = document.getElementById('cancel-person-edit-btn');
  const editFields = document.getElementById('person-summary-edit-fields');
  const infoDiv = document.getElementById('person-summary-info');
  const form = document.getElementById('person-summary-form');

  if (editBtn && saveBtn && cancelBtn && editFields && infoDiv && form) {
    editBtn.onclick = function() {
      // Show edit fields, hide summary
      document.getElementById('person-edit-name').value = editingPerson.name;
      document.getElementById('person-edit-birthday').value = editingPerson.birthday || '';
      document.getElementById('person-edit-notes').value = editingPerson.notes || '';
      editFields.style.display = '';
      infoDiv.style.display = 'none';
      editBtn.style.display = 'none';
      saveBtn.style.display = '';
      cancelBtn.style.display = '';
    };
    cancelBtn.onclick = function() {
      // Hide edit fields, show summary
      editFields.style.display = 'none';
      infoDiv.style.display = '';
      editBtn.style.display = '';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
    };
    form.onsubmit = async function(e) {
      e.preventDefault();
      if (!editingPerson) return;
      const name = document.getElementById('person-edit-name').value.trim();
      const birthday = document.getElementById('person-edit-birthday').value.trim();
      const notes = document.getElementById('person-edit-notes').value;
      if (!name) return;
      // Update in Supabase
      const { error } = await supabaseClient
        .from('people')
        .update({ name, birthday, notes })
        .eq('id', editingPerson.id);
      if (error) {
        alert('Failed to save changes.');
        return;
      }
      // Update local state
      editingPerson.name = name;
      editingPerson.birthday = birthday;
      editingPerson.notes = notes;
      const p = allPeopleList.find(p => p.id === editingPerson.id);
      if (p) {
        p.name = name;
        p.birthday = birthday;
        p.notes = notes;
      }
      // Re-render summary
      openPersonSummaryModal(editingPerson);
      renderPeopleList();
    };
  }
});
function openPersonModal() {
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('person-modal').style.display = 'block';
  document.getElementById('person-modal-title').textContent = 'Add Person';
  document.getElementById('person-form').reset();
}

function openPersonFromGiftModal() {
  // Save callback to reopen gift modal after adding person
  pendingPersonCallback = () => {
    if (giftModalMode === 'yearplan-given') {
      openYearPlanGiftModal('given');
    } else if (giftModalMode === 'yearplan-received') {
      openYearPlanGiftModal('received');
    }
  };
  
  closeGiftModal();
  openPersonModal();
}
window.openPersonFromGiftModal = openPersonFromGiftModal;

async function handlePersonFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('person-name').value.trim();
  const birthday = document.getElementById('person-birthday').value.trim();
  if (!name) return;
  
  console.log('[GiftPlan] Adding person:', name, birthday);
  
  try {
    const { data, error } = await supabaseClient
      .from('people')
      .insert([{ name, birthday, archived: false }])
      .select();
    
    if (error) {
      console.error('[GiftPlan] Error adding person:', error);
      return;
    }
    
    closePersonModal();
    
    // Refresh people list
    const people = await fetchAllPeopleData();
    allPeopleList = people.all;
    allPeople = people.active;
    archivedPeople = people.archived;
    
    renderPeopleList();
    
    // If we have a callback, execute it
    if (pendingPersonCallback) {
      const callback = pendingPersonCallback;
      pendingPersonCallback = null;
      callback();
    } else if (data && data[0]) {
      selectPerson(data[0].id);
    }
  } catch (err) {
    console.error('[GiftPlan] Exception adding person:', err);
  }
}

function closePersonModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('person-modal').style.display = 'none';
  document.getElementById('person-form').reset();
}
window.closePersonModal = closePersonModal;

// --- Gift Modal ---
function populateYearDropdown(selectId = 'gift-year') {
  const yearSelect = document.getElementById(selectId);
  if (!yearSelect) return;
  
  const now = new Date().getFullYear();
  const years = [now - 1, now, now + 1, now + 2];
  
  yearSelect.innerHTML = '<option value="">Anytime (No Year)</option>';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

function populatePersonDropdown() {
  const select = document.getElementById('gift-person-select');
  if (!select) return;
  
  select.innerHTML = '<option value="">Select Person</option>';
  
  // Add active people first
  allPeople.forEach(person => {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = person.name;
    select.appendChild(option);
  });
  
  // Add archived people
  if (archivedPeople.length > 0) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Archived';
    archivedPeople.forEach(person => {
      const option = document.createElement('option');
      option.value = person.id;
      option.textContent = `${person.name} (archived)`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }
}

// Open gift modal for People View (person already selected) - creates an "idea" type gift
function openGiftModalForPerson() {
  giftModalMode = 'people';
  editingGift = null;
  
  populateYearDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  document.getElementById('gift-modal-title').textContent = 'Add Gift Idea';
  
  // Hide person selector (we know the person)
  document.getElementById('gift-person-row').style.display = 'none';
  
  // Show fields for idea (priority shown, store/cost optional but shown)
  document.getElementById('gift-store-row').style.display = 'block';
  document.getElementById('gift-cost-row').style.display = 'block';
  document.getElementById('gift-priority-row').style.display = 'block';
  document.getElementById('gift-type-row').style.display = 'none';
  document.getElementById('gift-modal-info').style.display = 'none';
  
  // Reset form
  document.getElementById('gift-form').reset();
  
  // Set form handler
  document.getElementById('gift-form').onsubmit = handleGiftFormSubmit;
}
window.openGiftModal = openGiftModalForPerson;

// Open gift modal from Year Plan View
function openYearPlanGiftModal(type) {
  giftModalMode = type === 'received' ? 'yearplan-received' : 'yearplan-given';
  editingGift = null;
  
  populateYearDropdown();
  populatePersonDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  
  const isReceived = type === 'received';
  document.getElementById('gift-modal-title').textContent = isReceived ? 'Add Received Gift' : 'Add Gift';
  
  // Show person selector
  document.getElementById('gift-person-row').style.display = 'block';
  document.querySelector('#gift-person-row label').textContent = isReceived ? 'Gift from:' : 'Gift for:';
  
  // Show/hide fields based on type
  document.getElementById('gift-store-row').style.display = isReceived ? 'none' : 'block';
  document.getElementById('gift-cost-row').style.display = isReceived ? 'none' : 'block';
  document.getElementById('gift-priority-row').style.display = 'none'; // No priority for given/received
  document.getElementById('gift-type-row').style.display = 'block';
  // Set the type select to match the initial type
  document.getElementById('gift-type').value = isReceived ? 'received' : 'given';
  // Add event listener to update fields when type changes
  document.getElementById('gift-type').onchange = function() {
    const selectedType = this.value;
    const isReceivedType = selectedType === 'received';
    const isIdeaType = selectedType === 'idea';
    document.getElementById('gift-modal-title').textContent = isReceivedType ? 'Add Received Gift' : (isIdeaType ? 'Add Gift Idea' : 'Add Gift');
    document.querySelector('#gift-person-row label').textContent = isReceivedType ? 'Gift from:' : 'Gift for:';
    document.getElementById('gift-store-row').style.display = isReceivedType ? 'none' : 'block';
    document.getElementById('gift-cost-row').style.display = isReceivedType ? 'none' : 'block';
    document.getElementById('gift-priority-row').style.display = isIdeaType ? 'block' : 'none';
  };
  
  // Show info
  document.getElementById('gift-modal-info').style.display = 'block';
  document.getElementById('gift-year-display').textContent = `Year: ${yearPlanYear} (auto-assigned)`;
  
  // Reset form
  document.getElementById('gift-form').reset();
  document.getElementById('gift-year').value = yearPlanYear;
  
  // Set form handler
  document.getElementById('gift-form').onsubmit = handleGiftFormSubmit;
}
window.openYearPlanGiftModal = openYearPlanGiftModal;

// Open edit gift modal (full editing)
function openEditGiftModal(gift) {
  giftModalMode = 'edit';
  editingGift = gift;
  
  populateYearDropdown();
  populatePersonDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  document.getElementById('gift-modal-title').textContent = 'Edit Gift';
  
  // Show all fields for editing
  document.getElementById('gift-person-row').style.display = 'block';
  document.querySelector('#gift-person-row label').textContent = gift.type === 'received' ? 'Gift from:' : 'Gift for:';
  document.getElementById('gift-store-row').style.display = 'block';
  document.getElementById('gift-cost-row').style.display = 'block';
  document.getElementById('gift-type-row').style.display = 'block';
  document.getElementById('gift-modal-info').style.display = 'none';
  // Only show priority for 'idea' gifts
  document.getElementById('gift-priority-row').style.display = (gift.type === 'idea') ? 'block' : 'none';
  
  // Populate form
  document.getElementById('gift-person-select').value = gift.person_id || '';
  document.getElementById('gift-item').value = gift.item || '';
  document.getElementById('gift-occasion').value = gift.occasion || '';
  document.getElementById('gift-year').value = gift.year || '';
  document.getElementById('gift-priority').value = gift.priority || 'none';
  document.getElementById('gift-store').value = gift.store || '';
  document.getElementById('gift-cost').value = gift.cost || '';
  // No status field
  document.getElementById('gift-type').value = gift.type || 'given';
  document.getElementById('gift-notes').value = gift.notes || '';
  
  // Set form handler
  document.getElementById('gift-form').onsubmit = handleGiftFormSubmit;
}

async function handleGiftFormSubmit(e) {
  e.preventDefault();
  
  const item = document.getElementById('gift-item').value.trim();
  let occasion = document.getElementById('gift-occasion').value;
  if (!occasion || occasion === '') occasion = 'anytime';
  const yearVal = document.getElementById('gift-year').value;
  const year = (!yearVal || yearVal === '' || yearVal === 'anytime') ? null : parseInt(yearVal, 10);
  let priority = null;
  const store = document.getElementById('gift-store').value.trim();
  const cost = +document.getElementById('gift-cost').value || 0;
  const notes = document.getElementById('gift-notes').value.trim();

  let personId, type;
  if (giftModalMode === 'edit') {
    personId = document.getElementById('gift-person-select').value;
    type = document.getElementById('gift-type').value;
  } else if (giftModalMode === 'people') {
    personId = selectedPersonId;
    type = 'idea';
  } else if (giftModalMode === 'add-given') {
    personId = selectedPersonId;
    type = 'given';
  } else if (giftModalMode === 'add-received') {
    personId = selectedPersonId;
    type = 'received';
  } else if (giftModalMode === 'yearplan-given' || giftModalMode === 'yearplan-received') {
    personId = document.getElementById('gift-person-select').value;
    type = document.getElementById('gift-type').value;
  }
  if (type === 'idea') {
    priority = document.getElementById('gift-priority').value || 'none';
  }

  // Validate required fields for NOT NULL columns
  if (!personId) {
    alert('Please select a person.');
    return;
  }
  if (!item) {
    alert('Please enter an item.');
    return;
  }
  if (!occasion) {
    alert('Please select an occasion.');
    return;
  }
  if (!type) {
    alert('Gift type is required.');
    return;
  }

  try {
    if (editingGift) {
      // Update existing gift
      await supabaseClient
        .from('gifts')
        .update({ 
          person_id: personId,
          item, 
          occasion, 
          year, 
          type,
          store, 
          cost, 
          notes,
          priority: type === 'idea' ? priority : null
        })
        .eq('id', editingGift.id);
    } else {
      // Insert new gift
      const { data, error } = await supabaseClient
        .from('gifts')
        .insert([{ 
          person_id: personId,
          item,
          occasion,
          year,
          type,
          store,
          cost,
          notes,
          priority: type === 'idea' ? priority : null
        }])
        .select();
      if (error) {
        console.error('[GiftPlan] Error adding gift:', error);
      } else if (data && data[0]) {
        if (currentView === 'people') {
          allGiftsForPerson.push(data[0]);
        } else {
          yearPlanGifts.push(data[0]);
        }
      }
    }
    closeGiftModal();
    if (currentView === 'people') {
      await loadGiftsForSelectedPerson();
    } else {
      await loadYearPlanData();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception saving gift:', err);
  }
}

function closeGiftModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('gift-modal').style.display = 'none';
  document.getElementById('gift-form').reset();
  editingGift = null;
}
window.closeGiftModal = closeGiftModal;

// --- Navigation Handler ---
function handleNavigation(select) {
  const value = select.value;
  if (value) {
    window.location.href = value;
  }
}

// --- Initialize on page load ---
function initGiftPlan() {
  console.log('[GiftPlan] Initializing...');
  currentYear = new Date().getFullYear();
  if (!yearPlanYear) yearPlanYear = currentYear;
  initEventListeners();
  
  // Initialize mobile sub-view based on whether a person is selected
  if (selectedPersonId) {
    mobileSubView = 'ideas';
  } else {
    mobileSubView = 'people';
  }
  
  // Restore Show All Years checkbox state
  setTimeout(() => {
    const yearToggle = document.getElementById('show-all-years-toggle');
    if (yearToggle) yearToggle.checked = showAllYears;
    loadData();
    // Restore last view and person
    switchView(currentView);
    if (currentView === 'people' && selectedPersonId) {
      selectPerson(selectedPersonId);
    }
    window.addEventListener('resize', function() {
      updateMobilePeopleViewLayout();
      updateMobilePeopleSelectedState();
    });
    updateMobilePeopleViewLayout();
    updateMobilePeopleSelectedState();
  }, 0);
}

// This will be called when giftplan-app is shown (after auth)
const originalShowGiftPlan = window.showGiftPlan || function() {};
window.showGiftPlan = function() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('giftplan-app').style.display = 'block';
  setTimeout(initGiftPlan, 100);
};

// Also try to init on DOMContentLoaded if already authenticated
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const app = document.getElementById('giftplan-app');
    if (app && app.style.display !== 'none') {
      initGiftPlan();
    }
  }, 200);
});
