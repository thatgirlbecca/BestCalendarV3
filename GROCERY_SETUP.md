# Grocery List Setup Instructions

## Database Setup

To enable the grocery list feature, you need to create the `grocery_items` table in your Supabase database.

### Steps:

1. Log in to your Supabase dashboard at https://supabase.com
2. Navigate to your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New query"
5. Copy the contents of `setup_grocery_table.sql`
6. Paste it into the SQL editor
7. Click "Run" to execute the script

This will create:
- The `grocery_items` table with all necessary columns
- Indexes for better performance
- Row Level Security policies to ensure users only see their own items
- An automatic timestamp update trigger

### Table Structure

The `grocery_items` table includes:
- `id`: Unique identifier (UUID)
- `user_id`: Links to the authenticated user
- `name`: Item name (required)
- `type`: Category - 'cold', 'food', or 'not-food'
- `description`: Optional additional details
- `priority`: Optional priority - 'high', 'medium', or 'low'
- `labels`: Comma-separated tags
- `due_date`: Optional due date
- `checked`: Boolean indicating if item is archived
- `archived_at`: Timestamp when item was checked off
- `created_at`: When the item was created
- `updated_at`: When the item was last modified

## Features

### 1. Active List & Archive
- Switch between active grocery items and archived (checked-off) items
- Items are automatically archived when checked off

### 2. Item Types
- **❄️ Cold**: Refrigerated/frozen items
- **🍎 Food**: Regular food items
- **🧹 Not Food**: Household and non-food items

### 3. Item Management
- **Add Item**: Click "+ Add Item" button
- **Edit Item**: Click "Edit" button on any item
- **Delete Item**: Click "Delete" button (with confirmation)
- **Check Off**: Click the checkbox to archive an item

### 4. Item Details
- Click on any item to view its full details
- Details page includes options to check off, edit, or delete
- Shows all item information including description, labels, priority, and dates

### 5. Undo Feature
- When you check off an item, an undo notification appears
- Click "Undo" within 5 seconds to restore the item
- Notification automatically disappears after 5 seconds

### 6. Sorting
- Click "⚙️ Sort" to open the sort menu
- Primary sort options:
  - Type (Cold/Food/Not Food)
  - Priority
  - Due Date
  - Name
  - Date Added
- Secondary sort for tie-breaking
- Sort settings are saved per view (Active/Archive)

### 7. Optional Fields
- **Description**: Add additional details about the item
- **Priority**: Set urgency level (High/Medium/Low)
- **Labels**: Add custom tags (comma-separated)
- **Due Date**: Set a date by which you need the item

### 8. Shared Authentication
- Uses the same login system as Calendar and Todos
- Once logged in on any page, you're logged in on all pages
- Navigate between pages using the dropdown menu

## Navigation

Access the grocery list at: `oakleyfam.com/grocery.html`

Use the dropdown in the top-right to switch between:
- 📅 Calendar
- 📝 Todos
- 🛒 Grocery

## Mobile Responsive

The grocery list is fully responsive and works great on mobile devices:
- Sidebar collapses to icons only
- Item cards stack vertically
- Touch-friendly buttons and interactions
