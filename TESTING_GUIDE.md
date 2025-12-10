# Testing Guide for New Recurrence Features

## Before Testing
1. Run the SQL migration in Supabase:
   - Open your Supabase project
   - Go to SQL Editor
   - Copy and paste the contents of `add_nth_weekday_columns.sql`
   - Execute the query

## Test Case 1: 2nd Friday of Every Month
1. Click the + button to create a new event
2. Enter title: "Team Standup"
3. Select a date (any Friday)
4. Check "Repeat Event"
5. Select "Monthly on nth Weekday" from pattern dropdown
6. Verify "Which week?" and "Which day?" dropdowns appear
7. Select "2nd" for week
8. Select "Friday" for day
9. Keep interval at 1
10. Under "End Recurrence", select "After"
11. Enter 12 in the occurrences field
12. Save the event
13. Navigate through months to verify the event appears on the 2nd Friday of each month for 12 occurrences

## Test Case 2: Last Monday of Every Month
1. Create new event: "Monthly Review"
2. Check "Repeat Event"
3. Select "Monthly on nth Weekday"
4. Select "Last" for week
5. Select "Monday" for day
6. Keep interval at 1
7. Select "Never" for end recurrence
8. Save and verify it appears on the last Monday of each month

## Test Case 3: Weekly Event with Occurrence Limit
1. Create new event: "Training Session"
2. Check "Repeat Event"
3. Select "Weekly" pattern
4. Set interval to 1
5. Under "End Recurrence", select "After"
6. Enter 6 occurrences
7. Save
8. Verify the event appears for exactly 6 weeks

## Test Case 4: Edit Existing Recurring Event
1. Click on any recurring event
2. Click the edit button (✎)
3. Verify all recurrence fields are pre-filled correctly
4. Change the occurrence count
5. Save
6. Verify the changes are reflected

## Test Case 5: Duplicate Event with New Pattern
1. Click on any existing event
2. Click the duplicate button (📋)
3. Change to "Monthly on nth Weekday" pattern
4. Set to 1st Wednesday
5. Select a new date
6. Save
7. Verify the new recurring event is created correctly

## What to Look For
- ✅ UI fields show/hide correctly based on pattern selection
- ✅ Events appear on correct dates in calendar
- ✅ Occurrence limit stops events after specified count
- ✅ End date option still works
- ✅ "Never" option creates events indefinitely
- ✅ Edit and duplicate functions preserve recurrence settings
- ✅ No errors in browser console
