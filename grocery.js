// grocery.js - Grocery list functionality

let groceryItems = [];
let currentView = localStorage.getItem('groceryCurrentView') || 'active';
let editingItemId = null;
let lastArchivedItem = null;
let undoTimeout = null;

// Sort settings per view (stored in localStorage)
const getSortSettings = () => {
	const stored = localStorage.getItem('grocerySortSettings');
	return stored ? JSON.parse(stored) : {
		active: { by: 'type', direction: 'asc', secondaryBy: '', secondaryDirection: 'asc' },
		archive: { by: 'archived_at', direction: 'desc', secondaryBy: '', secondaryDirection: 'asc' }
	};
};

const saveSortSettings = (settings) => {
	localStorage.setItem('grocerySortSettings', JSON.stringify(settings));
};

let sortSettings = getSortSettings();

// Initialize grocery app on page load
window.addEventListener('DOMContentLoaded', async () => {
	await checkAuthOnLoad();
});

// Initialize the grocery list after authentication
async function initializeGroceryApp() {
	await loadGroceryItems();
	setupEventListeners();
	
	const savedView = localStorage.getItem('groceryCurrentView') || 'active';
	switchView(savedView);
}

// Setup event listeners
function setupEventListeners() {
	// Click outside modals to close
	window.onclick = (event) => {
		const itemModal = document.getElementById('item-modal');
		const detailsModal = document.getElementById('details-modal');
		if (event.target === itemModal) {
			closeItemForm();
		}
		if (event.target === detailsModal) {
			closeDetailsModal();
		}
	};
}

// Load grocery items from Supabase
async function loadGroceryItems() {
	try {
		const { data: { user } } = await supabaseClient.auth.getUser();
		if (!user) {
			console.error('No user logged in');
			showLogin();
			return;
		}

		const { data, error } = await supabaseClient
			.from('grocery_items')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error loading grocery items:', error);
			// Check if it's a missing table error
			if (error.message && error.message.includes('relation "public.grocery_items" does not exist')) {
				alert('The grocery_items table has not been created yet. Please run the SQL script in setup_grocery_table.sql in your Supabase dashboard.');
			} else {
				alert('Failed to load grocery items: ' + error.message);
			}
			return;
		}

		groceryItems = data || [];
		renderGroceryItems();
	} catch (error) {
		console.error('Error loading grocery items:', error);
		alert('Failed to load grocery items. Please check the console for details.');
	}
}

// Switch between views
function switchView(view) {
	console.log('Switching to view:', view);
	currentView = view;
	localStorage.setItem('groceryCurrentView', view);

	// Update view buttons
	document.querySelectorAll('.view-btn').forEach(btn => {
		btn.classList.toggle('active', btn.dataset.view === view);
	});

	// Update title
	const titles = {
		active: 'Active List',
		archive: 'Archive'
	};
	document.getElementById('view-title').textContent = titles[view];

	renderGroceryItems();
}

// Render grocery items based on current view
function renderGroceryItems() {
	const container = document.getElementById('grocery-list');
	
	let filteredItems = groceryItems.filter(item => {
		if (currentView === 'active') {
			return !item.checked;
		} else if (currentView === 'archive') {
			return item.checked;
		}
		return true;
	});

	// Apply sorting
	filteredItems = sortItems(filteredItems);

	if (filteredItems.length === 0) {
		container.innerHTML = `<p style="color: #999; text-align: center; padding: 40px;">No items to display</p>`;
		return;
	}

	container.innerHTML = filteredItems.map(item => `
		<div class="grocery-item" onclick="openDetailsModal('${item.id}')">
			<input type="checkbox" class="item-checkbox" ${item.checked ? 'checked' : ''} 
				onclick="event.stopPropagation(); toggleItemCheck('${item.id}')" />
			<div class="item-content">
				<div class="item-header">
					<div class="item-name">${escapeHtml(item.name)}</div>
				</div>
				<div class="item-type-row">
					<span class="item-type ${item.type}">${getTypeLabel(item.type)}</span>
					${item.labels ? `${item.labels.split(',').map(label => `<span class="label-tag">${escapeHtml(label.trim())}</span>`).join('')}` : ''}
				</div>
				<div class="item-meta">
					${item.priority ? `<span class="item-meta-item"><span class="priority-badge ${item.priority}">${item.priority.toUpperCase()}</span></span>` : ''}
					${item.due_date ? `<span class="item-meta-item">📅 ${formatDate(item.due_date)}</span>` : ''}
					${currentView === 'archive' ? `<span class="item-meta-item">✓ ${formatDate(item.archived_at)}</span>` : ''}
				</div>
				${item.description ? `<div class="item-description">📝 ${escapeHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</div>` : ''}
			</div>
			<div class="item-actions" onclick="event.stopPropagation()">
				<button class="item-action-btn" onclick="openEditItemForm('${item.id}')">Edit</button>
				<button class="item-action-btn delete" onclick="deleteItem('${item.id}')">Delete</button>
			</div>
		</div>
	`).join('');
}

// Sort items based on current settings
function sortItems(items) {
	const settings = sortSettings[currentView];
	
	return items.sort((a, b) => {
		// Primary sort
		let comparison = compareItems(a, b, settings.by, settings.direction);
		
		// Secondary sort if primary is equal
		if (comparison === 0 && settings.secondaryBy) {
			comparison = compareItems(a, b, settings.secondaryBy, settings.secondaryDirection);
		}
		
		return comparison;
	});
}

// Compare two items by a specific field
function compareItems(a, b, field, direction) {
	let aVal = a[field];
	let bVal = b[field];
	
	// Handle null/undefined values
	if (aVal === null || aVal === undefined) aVal = '';
	if (bVal === null || bVal === undefined) bVal = '';
	
	// Type ordering
	if (field === 'type') {
		const typeOrder = { 'cold': 1, 'food': 2, 'not-food': 3 };
		aVal = typeOrder[aVal] || 999;
		bVal = typeOrder[bVal] || 999;
	}
	
	// Priority ordering
	if (field === 'priority') {
		const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3, '': 999 };
		aVal = priorityOrder[aVal] || 999;
		bVal = priorityOrder[bVal] || 999;
	}
	
	// Date comparison
	if (field === 'due_date' || field === 'archived_at' || field === 'created_at') {
		aVal = aVal ? new Date(aVal).getTime() : 0;
		bVal = bVal ? new Date(bVal).getTime() : 0;
	}
	
	// String comparison (case-insensitive)
	if (typeof aVal === 'string' && typeof bVal === 'string') {
		aVal = aVal.toLowerCase();
		bVal = bVal.toLowerCase();
	}
	
	let result = 0;
	if (aVal < bVal) result = -1;
	if (aVal > bVal) result = 1;
	
	return direction === 'desc' ? -result : result;
}

// Toggle item checked status
async function toggleItemCheck(itemId) {
	const item = groceryItems.find(i => i.id === itemId);
	if (!item) return;

	const newCheckedState = !item.checked;

	try {
		const updateData = {
			checked: newCheckedState,
			archived_at: newCheckedState ? new Date().toISOString() : null
		};

		const { error } = await supabaseClient
			.from('grocery_items')
			.update(updateData)
			.eq('id', itemId);

		if (error) throw error;

		item.checked = newCheckedState;
		item.archived_at = updateData.archived_at;

		if (newCheckedState) {
			// Show undo notification
			lastArchivedItem = { ...item };
			showUndoNotification(item.name);
		}

		renderGroceryItems();
	} catch (error) {
		console.error('Error updating item:', error);
		alert('Failed to update item');
	}
}

// Show undo notification
function showUndoNotification(itemName) {
	const notification = document.getElementById('undo-notification');
	const message = document.getElementById('undo-message');
	
	message.textContent = `"${itemName}" checked off`;
	notification.style.display = 'flex';

	// Clear previous timeout
	if (undoTimeout) {
		clearTimeout(undoTimeout);
	}

	// Auto-hide after 5 seconds
	undoTimeout = setTimeout(() => {
		notification.style.display = 'none';
		lastArchivedItem = null;
	}, 5000);
}

// Undo archive
async function undoArchive() {
	if (!lastArchivedItem) return;

	try {
		const { error } = await supabaseClient
			.from('grocery_items')
			.update({ checked: false, archived_at: null })
			.eq('id', lastArchivedItem.id);

		if (error) throw error;

		const item = groceryItems.find(i => i.id === lastArchivedItem.id);
		if (item) {
			item.checked = false;
			item.archived_at = null;
		}

		document.getElementById('undo-notification').style.display = 'none';
		lastArchivedItem = null;
		
		if (undoTimeout) {
			clearTimeout(undoTimeout);
		}

		renderGroceryItems();
	} catch (error) {
		console.error('Error undoing archive:', error);
		alert('Failed to undo');
	}
}

// Open add item form
function openAddItemForm() {
	editingItemId = null;
	document.getElementById('modal-title').textContent = 'Add Grocery Item';
	document.getElementById('item-form').reset();
	document.getElementById('item-modal').style.display = 'block';
	setTimeout(() => document.getElementById('item-name').focus(), 100);
}

// Open edit item form
function openEditItemForm(itemId) {
	const item = groceryItems.find(i => i.id === itemId);
	if (!item) return;

	editingItemId = itemId;
	document.getElementById('modal-title').textContent = 'Edit Grocery Item';
	
	document.getElementById('item-name').value = item.name;
	document.getElementById('item-type').value = item.type || 'food';
	document.getElementById('item-description').value = item.description || '';
	document.getElementById('item-priority').value = item.priority || '';
	document.getElementById('item-labels').value = item.labels || '';
	document.getElementById('item-due-date').value = item.due_date || '';

	document.getElementById('item-modal').style.display = 'block';
	setTimeout(() => document.getElementById('item-name').focus(), 100);
}

// Close item form
function closeItemForm() {
	document.getElementById('item-modal').style.display = 'none';
	document.getElementById('item-form').reset();
	editingItemId = null;
}

// Handle item form submission
async function handleItemSubmit(event) {
	event.preventDefault();

	const { data: { user } } = await supabaseClient.auth.getUser();
	if (!user) {
		alert('You must be logged in to save items');
		return;
	}

	const itemData = {
		name: document.getElementById('item-name').value.trim(),
		type: document.getElementById('item-type').value,
		description: document.getElementById('item-description').value.trim() || null,
		priority: document.getElementById('item-priority').value || null,
		labels: document.getElementById('item-labels').value.trim() || null,
		due_date: document.getElementById('item-due-date').value || null,
		checked: false
	};

	try {
		if (editingItemId) {
			// Update existing item
			const { error } = await supabaseClient
				.from('grocery_items')
				.update(itemData)
				.eq('id', editingItemId);

			if (error) throw error;

			const item = groceryItems.find(i => i.id === editingItemId);
			Object.assign(item, itemData);
		} else {
			// Create new item
			itemData.user_id = user.id;
			
			const { data, error } = await supabaseClient
				.from('grocery_items')
				.insert([itemData])
				.select();

			if (error) throw error;

			groceryItems.unshift(data[0]);
		}

		closeItemForm();
		renderGroceryItems();
	} catch (error) {
		console.error('Error saving item:', error);
		alert('Failed to save item');
	}
}

// Delete item
async function deleteItem(itemId) {
	if (!confirm('Are you sure you want to delete this item?')) return;

	try {
		const { error } = await supabaseClient
			.from('grocery_items')
			.delete()
			.eq('id', itemId);

		if (error) throw error;

		groceryItems = groceryItems.filter(i => i.id !== itemId);
		renderGroceryItems();
	} catch (error) {
		console.error('Error deleting item:', error);
		alert('Failed to delete item');
	}
}

// Open details modal
function openDetailsModal(itemId) {
	const item = groceryItems.find(i => i.id === itemId);
	if (!item) return;

	const detailsBody = document.getElementById('details-body');
	
	detailsBody.innerHTML = `
		<div class="details-header">
			<div class="details-title">${escapeHtml(item.name)}</div>
			<div class="details-actions">
				${!item.checked ? `<button class="details-btn check" onclick="toggleItemCheck('${item.id}'); closeDetailsModal();">✓ Check Off</button>` : ''}
				<button class="details-btn edit" onclick="closeDetailsModal(); openEditItemForm('${item.id}');">Edit</button>
				<button class="details-btn delete" onclick="closeDetailsModal(); deleteItem('${item.id}');">Delete</button>
			</div>
		</div>

		<div class="details-section">
			<div class="details-label">Type</div>
			<div class="details-value">
				<span class="details-type item-type ${item.type}">${getTypeLabel(item.type)}</span>
			</div>
		</div>

		${item.description ? `
			<div class="details-section">
				<div class="details-label">Description</div>
				<div class="details-value">${escapeHtml(item.description)}</div>
			</div>
		` : ''}

		${item.priority ? `
			<div class="details-section">
				<div class="details-label">Priority</div>
				<div class="details-value">
					<span class="details-priority priority-badge ${item.priority}">${item.priority.toUpperCase()}</span>
				</div>
			</div>
		` : ''}

		${item.labels ? `
			<div class="details-section">
				<div class="details-label">Labels</div>
				<div class="details-labels">
					${item.labels.split(',').map(label => `<span class="details-label-tag">${escapeHtml(label.trim())}</span>`).join('')}
				</div>
			</div>
		` : ''}

		${item.due_date ? `
			<div class="details-section">
				<div class="details-label">Due Date</div>
				<div class="details-value">📅 ${formatDate(item.due_date)}</div>
			</div>
		` : ''}

		${item.archived_at ? `
			<div class="details-section">
				<div class="details-label">Checked Off</div>
				<div class="details-value">✓ ${formatDate(item.archived_at)}</div>
			</div>
		` : ''}

		<div class="details-section">
			<div class="details-label">Date Added</div>
			<div class="details-value">${formatDate(item.created_at)}</div>
		</div>
	`;

	document.getElementById('details-modal').style.display = 'block';
}

// Close details modal
function closeDetailsModal() {
	document.getElementById('details-modal').style.display = 'none';
}

// Open sort menu modal
function openSortMenu() {
	const modal = document.getElementById('sort-modal');
	const settings = sortSettings[currentView];
	
	// Populate modal with current settings
	document.getElementById('sort-select-modal').value = settings.by;
	document.getElementById('sort-direction-modal-btn').textContent = settings.direction === 'asc' ? '↑' : '↓';
	document.getElementById('sort-direction-modal-btn').dataset.direction = settings.direction;
	
	document.getElementById('sort-select-secondary-modal').value = settings.secondaryBy || '';
	document.getElementById('sort-direction-secondary-modal-btn').textContent = settings.secondaryDirection === 'asc' ? '↑' : '↓';
	document.getElementById('sort-direction-secondary-modal-btn').dataset.direction = settings.secondaryDirection;
	
	modal.style.display = 'block';
}

// Close sort menu modal
function closeSortMenu() {
	document.getElementById('sort-modal').style.display = 'none';
}

// Toggle modal sort direction
function toggleModalSortDirection() {
	const btn = document.getElementById('sort-direction-modal-btn');
	const currentDirection = btn.dataset.direction || 'asc';
	const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
	btn.dataset.direction = newDirection;
	btn.textContent = newDirection === 'asc' ? '↑' : '↓';
}

// Toggle modal secondary sort direction
function toggleModalSecondarySortDirection() {
	const btn = document.getElementById('sort-direction-secondary-modal-btn');
	const currentDirection = btn.dataset.direction || 'asc';
	const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
	btn.dataset.direction = newDirection;
	btn.textContent = newDirection === 'asc' ? '↑' : '↓';
}

// Apply sort settings from modal
function applySortFromModal() {
	const sortBy = document.getElementById('sort-select-modal').value;
	const direction = document.getElementById('sort-direction-modal-btn').dataset.direction || 'asc';
	const secondarySortBy = document.getElementById('sort-select-secondary-modal').value;
	const secondaryDirection = document.getElementById('sort-direction-secondary-modal-btn').dataset.direction || 'asc';
	
	sortSettings[currentView].by = sortBy;
	sortSettings[currentView].direction = direction;
	sortSettings[currentView].secondaryBy = secondarySortBy;
	sortSettings[currentView].secondaryDirection = secondaryDirection;
	
	saveSortSettings(sortSettings);
	renderGroceryItems();
	closeSortMenu();
}

// Get type label with emoji
function getTypeLabel(type) {
	const labels = {
		'cold': '❄️ Cold',
		'food': '🍙 Food',
		'not-food': '🧹 Not Food'
	};
	return labels[type] || type;
}

// Format date for display
function formatDate(dateString) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Navigation dropdown handler
function handleNavigation(select) {
	const value = select.value;
	if (value) {
		window.location.href = value;
	}
}

// Override the calendar's initializeCalendar to call grocery initialization instead
function initializeCalendar() {
	initializeGroceryApp();
}
