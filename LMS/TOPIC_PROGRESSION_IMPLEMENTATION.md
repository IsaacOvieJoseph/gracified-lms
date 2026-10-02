# Topic Progression System - Implementation Summary

## Overview
Implemented a comprehensive topic progression system that allows authorized users to manage topic flow with duration tracking and automatic/manual progression.

## Database Changes

### Topic Model Enhancements
Added the following fields to the Topic schema:

```javascript
duration: {
  mode: String,  // 'not_sure', 'day', 'week', 'month', 'year'
  value: Number  // Duration value (e.g., 2 weeks = {mode: 'week', value: 2})
}

status: String,  // 'pending', 'active', 'completed'
startedAt: Date,
completedAt: Date,
expectedEndDate: Date,  // Calculated based on duration
nextTopicId: ObjectId,  // Manual override for next topic
completedBy: ObjectId   // User who marked it complete
```

### Classroom Model Enhancement
Added field to track current active topic:
```javascript
currentTopicId: ObjectId  // Reference to current Topic
```

## Backend API Endpoints

### New Topic Progression Endpoints

1. **GET `/api/topics/classroom/:classroomId/current`**
   - Get the current active topic for a classroom
   - Returns the topic marked as active or first pending topic

2. **POST `/api/topics/:id/complete`**
   - Mark a topic as completed
   - Automatically activates the next topic (by manual selection or order)
   - Authorized roles: root_admin, school_admin, teacher, personal_teacher
   - Returns: `{ completedTopic, nextTopic }`

3. **PUT `/api/topics/:id/set-next`**
   - Manually set which topic should come next
   - Body: `{ nextTopicId }`
   - Overrides automatic order-based progression
   - Authorized roles: root_admin, school_admin, teacher, personal_teacher

4. **POST `/api/topics/:id/activate`**
   - Manually activate a topic (start it)
   - Sets status to 'active', records startedAt
   - Calculates expectedEndDate based on duration
   - Authorized roles: root_admin, school_admin, teacher, personal_teacher

### Updated Endpoints

**POST `/api/topics/`** - Enhanced to accept duration:
```javascript
{
  name: String,
  description: String,
  classroomId: ObjectId,
  duration: {
    mode: 'not_sure' | 'day' | 'week' | 'month' | 'year',
    value: Number
  },
  // ... other fields
}
```

## Topic Progression Logic

### Automatic Progression
- When a topic is marked complete, the system automatically:
  1. Sets topic status to 'completed'
  2. Records completedAt timestamp
  3. Finds the next topic (manual selection or by order)
  4. Activates the next topic
  5. Calculates expectedEndDate for the next topic
  6. Updates classroom's currentTopicId

### Manual Progression
- Authorized users can:
  - Manually mark topics as complete
  - Set custom next topic (override order)
  - Activate any topic at any time

### Auto-Progression by Duration
- Daily cron job (midnight) checks for topics where:
  - Status is 'active'
  - expectedEndDate has passed
- Automatically completes these topics and activates next ones

## Duration Calculation

```javascript
// Examples:
{ mode: 'day', value: 3 }     // 3 days
{ mode: 'week', value: 2 }    // 2 weeks
{ mode: 'month', value: 1 }   // 1 month
{ mode: 'year', value: 1 }    // 1 year
{ mode: 'not_sure', value: 1 } // No auto-progression
```

## Notification Enhancements

### Class Reminders Now Include Topic Info
- In-app notifications include current topic name
- Email reminders show:
  - Current topic name
  - Topic description (if available)
  - Enhanced subject line with topic

Example:
```
Subject: Class Reminder: Mathematics 101 - Introduction to Algebra
Body includes:
  - Class name
  - Start time
  - Current Topic: Introduction to Algebra
  - Topic description
```

## Scheduler Updates

### New Cron Job
- **Daily at Midnight (00:00)**: Check for topics that should auto-progress
- Logs all auto-progressions for audit trail

### Enhanced Reminder Job
- Populates currentTopicId when fetching classrooms
- Includes topic information in notifications

## Helper Utilities

### topicProgressionHelper.js
Core functions:
- `calculateExpectedEndDate(startDate, duration)` - Calculate when topic should end
- `getNextTopic(currentTopic, classroomId)` - Find next topic (manual or by order)
- `getCurrentTopic(classroomId)` - Get active/pending topic
- `markTopicComplete(topicId, userId)` - Complete and progress
- `setNextTopic(currentTopicId, nextTopicId)` - Set manual next
- `activateTopic(topicId)` - Start a topic
- `checkAutoProgression()` - Check and auto-progress expired topics

## Usage Flow

### Creating a Topic with Duration
```javascript
POST /api/topics
{
  "name": "Introduction to Variables",
  "description": "Learn about variables in programming",
  "classroomId": "...",
  "duration": {
    "mode": "week",
    "value": 2
  }
}
```

### Starting a Topic
```javascript
POST /api/topics/:topicId/activate
// Sets status to 'active', calculates end date
```

### Completing a Topic
```javascript
POST /api/topics/:topicId/complete
// Marks complete, activates next topic automatically
```

### Setting Custom Next Topic
```javascript
PUT /api/topics/:topicId/set-next
{
  "nextTopicId": "..."
}
// Next time this topic completes, specified topic activates
```

## Frontend Integration Requirements

### Topic Create/Edit Form
Add duration fields:
- Dropdown: mode (Not Sure, Day, Week, Month, Year)
- Number input: value (1-999)

### Topic Management UI
Display:
- Topic status badge (Pending/Active/Completed)
- Duration info
- Expected end date (if active)
- Progress indicators

### Action Buttons (for authorized users)
- "Mark as Complete" button
- "Set as Next Topic" option
- "Activate Topic" button
- Topic progression timeline/flow

### Topic Display
Show:
- Current active topic highlighted
- Completed topics with checkmarks
- Pending topics grayed out
- Custom next topic indicators

## Benefits

1. **Structured Learning**: Clear topic progression path
2. **Flexibility**: Manual override when needed
3. **Automation**: Auto-progress based on duration
4. **Visibility**: Students see current topic in reminders
5. **Control**: Teachers manage topic flow
6. **Tracking**: Audit trail of who completed what and when

## Next Steps for Frontend

1. Update topic creation/edit forms with duration fields
2. Add topic status indicators in classroom detail
3. Implement "Mark Complete" and "Set Next" buttons
4. Show current topic prominently in classroom view
5. Display topic progression timeline
6. Add topic status filters (Active/Pending/Completed)
