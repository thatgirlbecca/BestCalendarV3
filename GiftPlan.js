// GiftPlan.js - Full backend logic for Gift Plan page (Part 3 - People View + Year Plan View + Stats & History)
// Uses supabaseClient (from supabase.js)

// --- State ---
// --- Persistent State ---
let currentView = localStorage.getItem('giftplan_currentView') || 'people'; // 'people' or 'yearplan'
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
  
  // Update tab styling
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Show/hide view containers
  document.getElementById('people-view').style.display = view === 'people' ? 'flex' : 'none';
  document.getElementById('yearplan-view').style.display = view === 'yearplan' ? 'flex' : 'none';
  
  // Load data for the view
  if (view === 'yearplan') {
    loadYearPlanData();
  }
  
  console.log('[GiftPlan] Switched to view:', view);
}
window.switchView = switchView;

// --- Archived Section Toggle ---
function toggleArchivedSection() {
  showArchivedPeople = !showArchivedPeople;
  
  const btn = document.getElementById('toggle-archived-btn');
  const list = document.getElementById('archived-people-list');
  
  if (showArchivedPeople) {
    btn.textContent = 'Archived ▲';
    btn.classList.add('expanded');
    list.style.display = 'block';
    renderArchivedPeopleList();
  } else {
    btn.textContent = 'Archived ▼';
    btn.classList.remove('expanded');
    list.style.display = 'none';
  }
}
window.toggleArchivedSection = toggleArchivedSection;

// --- Year Filter Toggle (People View) ---
function handleYearFilterChange() {
  const checkbox = document.getElementById('show-all-years-toggle');
  showAllYears = checkbox.checked;
  localStorage.setItem('giftplan_showAllYears', showAllYears);
  
  const label = document.querySelector('.current-year-label');
  if (label) {
    label.textContent = showAllYears ? '(Showing: All Years)' : '(Currently: This Year Only)';
  }
  
  renderGiftBoxes();
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
  
  if (showArchivedPeople) {
    renderArchivedPeopleList();
  }
  
  if (selectedPersonId) {
    allGiftsForPerson = await fetchAllGiftsForPerson(selectedPersonId);
  } else {
    allGiftsForPerson = [];
  }
  
  renderGiftBoxes();
  
  // Render stats and history
  renderStatsAndHistory();
  
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
    
    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'archive-btn';
    archiveBtn.textContent = '📁';
    archiveBtn.title = 'Archive Person';
    archiveBtn.onclick = (e) => { e.stopPropagation(); toggleArchive(person.id); };
    actions.appendChild(archiveBtn);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete Person';
    delBtn.onclick = (e) => { e.stopPropagation(); deletePerson(person.id); };
    actions.appendChild(delBtn);
    
    li.appendChild(actions);
    ul.appendChild(li);
  });
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
    
    const unarchiveBtn = document.createElement('button');
    unarchiveBtn.className = 'archive-btn';
    unarchiveBtn.textContent = '📤';
    unarchiveBtn.title = 'Unarchive Person';
    unarchiveBtn.onclick = (e) => { e.stopPropagation(); toggleArchive(person.id); };
    actions.appendChild(unarchiveBtn);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete Person';
    delBtn.onclick = (e) => { e.stopPropagation(); deletePerson(person.id); };
    actions.appendChild(delBtn);
    
    li.appendChild(actions);
    ul.appendChild(li);
  });
}

function renderGiftBoxes() {
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
    if (totalEl) totalEl.textContent = 'Total: $0.00';
    container.innerHTML = `
      <div class="no-person-selected">
        <p>👈 Select a person from the list</p>
        <p>to view and manage their gift plan</p>
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

  const filteredGifts = filterGiftsByYear(allGiftsForPerson, showAllYears, currentYear);

  const total = filteredGifts
    .filter(g => g.status === 'purchased')
    .reduce((sum, g) => sum + (+g.cost || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${formatCurrency(total)}`;

  if (filteredGifts.length === 0) {
    container.innerHTML = `
      <div class="empty-gifts-state">
        <p>No gifts yet for ${person?.name || 'this person'}.</p>
        <p>Click the + button above to add a gift idea!</p>
      </div>
    `;
    return;
  }

  const grouped = groupGiftsByYear(filteredGifts);

  if (grouped.anytime.length > 0) {
    const section = createYearSection('💡 GIFT IDEAS (ANYTIME)', grouped.anytime);
    container.appendChild(section);
  }
  
  const years = Object.keys(grouped.byYear).sort((a, b) => b - a);
  years.forEach(year => {
    const gifts = grouped.byYear[year];
    const section = createYearSection(`📅 ${year} GIFTS`, gifts);
    container.appendChild(section);
  });
}

function createYearSection(title, gifts) {
  const section = document.createElement('div');
  section.className = 'year-section';
  
  const header = document.createElement('div');
  header.className = 'year-section-header';
  header.innerHTML = `${title} <span class="year-section-count">(${gifts.length})</span>`;
  section.appendChild(header);
  
  gifts.forEach(gift => {
    const box = createGiftBox(gift, false);
    section.appendChild(box);
  });
  
  return section;
}

function createGiftBox(gift, showPersonName = false, isReceived = false) {
  const box = document.createElement('div');
  box.className = `gift-box priority-${gift.priority || 'none'}${isReceived ? ' received' : ''}`;
  
  // Header
  const header = document.createElement('div');
  header.className = 'gift-box-header';
  
  if (!isReceived) {
    const statusSpan = document.createElement('span');
    statusSpan.className = `gift-status ${gift.status || 'idea'}`;
    statusSpan.textContent = getStatusIcon(gift.status);
    statusSpan.title = 'Click to change status';
    statusSpan.onclick = () => cycleGiftStatus(gift);
    header.appendChild(statusSpan);
  }
  
  const itemSpan = document.createElement('strong');
  itemSpan.textContent = gift.item || '(No item)';
  header.appendChild(itemSpan);
  
  box.appendChild(header);
  
  // Body
  const body = document.createElement('div');
  body.className = 'gift-box-body';
  
  // Store + Cost (only for given gifts)
  if (!isReceived && (gift.store || gift.cost)) {
    const storeCost = document.createElement('div');
    storeCost.className = 'gift-box-store-cost';
    const parts = [];
    if (gift.store) parts.push(gift.store);
    if (gift.cost) parts.push(`<span class="gift-cost">${formatCurrency(gift.cost)}</span>`);
    storeCost.innerHTML = parts.join(' - ');
    body.appendChild(storeCost);
  }
  
  // Actions row
  const actions = document.createElement('div');
  actions.className = 'gift-box-actions';
  
  if (!isReceived) {
    // Year button
    const yearBtn = document.createElement('button');
    yearBtn.className = 'year-btn' + (gift.year ? '' : ' unassigned');
    if (gift.year && gift.occasion) {
      yearBtn.textContent = `[${gift.year}-${capitalizeOccasion(gift.occasion)}]`;
    } else if (gift.year) {
      yearBtn.textContent = `[${gift.year}]`;
    } else {
      yearBtn.textContent = '[Assign to Year]';
    }
    yearBtn.onclick = () => openEditGiftModal(gift);
    actions.appendChild(yearBtn);
  }
  
  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit Gift';
  editBtn.onclick = () => openEditGiftModal(gift);
  actions.appendChild(editBtn);
  
  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '🗑️';
  delBtn.title = 'Delete Gift';
  delBtn.onclick = () => deleteGift(gift.id);
  actions.appendChild(delBtn);
  
  body.appendChild(actions);
  
  // Priority selector (only for given gifts)
  if (!isReceived) {
    const priorityDiv = document.createElement('div');
    priorityDiv.className = 'gift-box-priority';
    priorityDiv.innerHTML = `
      Priority: 
      <select onchange="updateGiftPriority('${gift.id}', this.value)">
        <option value="none" ${gift.priority === 'none' || !gift.priority ? 'selected' : ''}>None</option>
        <option value="low" ${gift.priority === 'low' ? 'selected' : ''}>Low</option>
        <option value="medium" ${gift.priority === 'medium' ? 'selected' : ''}>Medium</option>
        <option value="high" ${gift.priority === 'high' ? 'selected' : ''}>High</option>
      </select>
    `;
    body.appendChild(priorityDiv);
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
    gifts.forEach(gift => {
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
    switchView('people');
    selectPerson(personId);
  };
  return link;
}

function updateYearPlanTotals(givenGifts) {
  const spent = givenGifts
    .filter(g => g.status === 'purchased')
    .reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  const potential = givenGifts
    .reduce((sum, g) => sum + (+g.cost || 0), 0);
  
  // Header totals
  const spentEl = document.getElementById('yearplan-spent');
  const potentialEl = document.getElementById('yearplan-potential');
  if (spentEl) spentEl.textContent = `Spent: ${formatCurrency(spent)}`;
  if (potentialEl) potentialEl.textContent = `Potential: ${formatCurrency(potential)}`;
  
  // Column totals
  const givenSpentEl = document.getElementById('yearplan-given-spent');
  const givenPotentialEl = document.getElementById('yearplan-given-potential');
  if (givenSpentEl) givenSpentEl.textContent = `Spent: ${formatCurrency(spent)}`;
  if (givenPotentialEl) givenPotentialEl.textContent = `Potential: ${formatCurrency(potential)}`;
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
}

async function loadGiftsForSelectedPerson() {
  if (selectedPersonId) {
    allGiftsForPerson = await fetchAllGiftsForPerson(selectedPersonId);
  } else {
    allGiftsForPerson = [];
  }
  renderGiftBoxes();
  
  // Render stats and history
  renderStatsAndHistory();
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
    
    // For 'given', only show purchased. For 'received', show all
    const filteredGifts = type === 'given' 
      ? yearGifts.filter(g => g.status === 'purchased')
      : yearGifts;
    
    if (filteredGifts.length === 0) return;
    hasAnyGifts = true;
    
    const isCollapsed = collapsedYears.has(`${type}-${year}`);
    
    html += `
      <div class="history-year" data-year="${year}" data-type="${type}">
        <div class="history-year-header" onclick="toggleHistoryYear(${year}, '${type}')">
          📅 ${year} <span class="year-toggle">${isCollapsed ? '▶' : '▼'}</span>
        </div>
        <div class="history-year-content${isCollapsed ? ' collapsed' : ''}">
    `;
    
    filteredGifts.forEach(gift => {
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

function renderStatsAndHistory() {
  if (!selectedPersonId) {
    const statsContainer = document.getElementById('stats-container');
    const historyContainer = document.getElementById('history-container');
    if (statsContainer) statsContainer.innerHTML = '<div class="stats-empty">Select a person to view stats</div>';
    if (historyContainer) historyContainer.innerHTML = '';
    return;
  }
  
  const stats = calculateStats(allGiftsForPerson);
  renderStats(stats);
  renderHistory(allGiftsForPerson);
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
      renderGiftBoxes();
    } else {
      renderYearPlanView();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception updating priority:', err);
  }
}
window.updateGiftPriority = updateGiftPriority;

// --- Status Cycling ---
async function cycleGiftStatus(gift) {
  const next = gift.status === 'idea' ? 'purchased' : (gift.status === 'purchased' ? 'rejected' : 'idea');
  console.log('[GiftPlan] Cycling status:', gift.id, gift.status, '->', next);
  try {
    const { error } = await supabaseClient
      .from('gifts')
      .update({ status: next })
      .eq('id', gift.id);
    
    if (error) {
      console.error('[GiftPlan] Error updating status:', error);
      return;
    }
    
    gift.status = next;
    
    if (currentView === 'people') {
      renderGiftBoxes();
    } else {
      renderYearPlanView();
    }
  } catch (err) {
    console.error('[GiftPlan] Exception updating status:', err);
  }
}

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
      renderGiftBoxes();
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

// --- Person Modal ---
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

// Open gift modal for People View (person already selected)
function openGiftModalForPerson() {
  giftModalMode = 'people';
  editingGift = null;
  
  populateYearDropdown();
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('gift-modal').style.display = 'block';
  document.getElementById('gift-modal-title').textContent = 'Add Gift';
  
  // Hide person selector (we know the person)
  document.getElementById('gift-person-row').style.display = 'none';
  
  // Show all given gift fields
  document.getElementById('gift-store-row').style.display = 'block';
  document.getElementById('gift-cost-row').style.display = 'block';
  document.getElementById('gift-priority-row').style.display = 'block';
  document.getElementById('gift-status-row').style.display = 'none';
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
  document.getElementById('gift-priority-row').style.display = isReceived ? 'none' : 'block';
  document.getElementById('gift-status-row').style.display = 'none';
  document.getElementById('gift-type-row').style.display = 'none';
  
  // Show info
  document.getElementById('gift-modal-info').style.display = 'block';
  document.getElementById('gift-year-display').textContent = `Year: ${yearPlanYear} (auto-assigned) | Status: Idea`;
  
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
  document.getElementById('gift-priority-row').style.display = 'block';
  document.getElementById('gift-status-row').style.display = 'block';
  document.getElementById('gift-type-row').style.display = 'block';
  document.getElementById('gift-modal-info').style.display = 'none';
  
  // Populate form
  document.getElementById('gift-person-select').value = gift.person_id || '';
  document.getElementById('gift-item').value = gift.item || '';
  document.getElementById('gift-occasion').value = gift.occasion || '';
  document.getElementById('gift-year').value = gift.year || '';
  document.getElementById('gift-priority').value = gift.priority || 'none';
  document.getElementById('gift-store').value = gift.store || '';
  document.getElementById('gift-cost').value = gift.cost || '';
  document.getElementById('gift-status').value = gift.status || 'idea';
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
  const priority = document.getElementById('gift-priority').value || 'none';
  const store = document.getElementById('gift-store').value.trim();
  const cost = +document.getElementById('gift-cost').value || 0;
  const notes = document.getElementById('gift-notes').value.trim();
  
  let personId, status, type;

  if (giftModalMode === 'edit') {
    personId = document.getElementById('gift-person-select').value;
    status = document.getElementById('gift-status').value || 'idea';
    type = document.getElementById('gift-type').value || 'given';
  } else if (giftModalMode === 'people') {
    personId = selectedPersonId;
    status = 'idea';
    type = 'given';
  } else if (giftModalMode === 'yearplan-given') {
    personId = document.getElementById('gift-person-select').value;
    status = 'idea';
    type = 'given';
  } else if (giftModalMode === 'yearplan-received') {
    personId = document.getElementById('gift-person-select').value;
    status = 'idea';
    type = 'received';
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
  
  if (!personId) {
    alert('Please select a person.');
    return;
  }
  
  try {
    if (editingGift) {
      // Update existing gift
      console.log('[GiftPlan] Updating gift:', editingGift.id);
      const { error } = await supabaseClient
        .from('gifts')
        .update({ 
          person_id: personId,
          item, 
          occasion, 
          year, 
          priority, 
          store, 
          cost, 
          notes,
          status,
          type
        })
        .eq('id', editingGift.id);
      if (error) console.error('[GiftPlan] Error updating gift:', error);
    } else {
      // Insert new gift and select it
      console.log('[GiftPlan] Adding new gift');
      const { data, error } = await supabaseClient
        .from('gifts')
        .insert([{
          person_id: personId,
          year,
          type,
          status,
          item,
          occasion,
          priority,
          store,
          cost,
          notes
        }])
        .select();
      if (error) {
        console.error('[GiftPlan] Error adding gift:', error);
      } else if (data && data[0]) {
        // Add to local state for immediate display
        if (currentView === 'people') {
          allGiftsForPerson.push(data[0]);
        } else {
          yearPlanGifts.push(data[0]);
        }
      }
    }
    
    closeGiftModal();
    
    // Refresh data
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
