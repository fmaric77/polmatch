# Unified Messaging System - Discord-like Interface

## Overview
The unified messaging system combines private messages and group messages into a single Discord-like interface, providing a seamless chat experience for users.

## Features

### 🎯 Core Features
- **Unified Interface**: Single page for all conversations (DMs + Groups)
- **Discord-like UI**: Familiar sidebar with conversations list
- **Real-time Updates**: Auto-refresh messages every 3 seconds
- **Message Types**: Support for both direct messages and group messages
- **Visual Indicators**: Icons show message types (@ for DMs, # for groups)

### 💬 Direct Messages
- **Start New DMs**: Click the user icon to start conversations
- **User Selection**: Dropdown to select from available users
- **Message History**: View full conversation history
- **Encrypted Messages**: All messages are encrypted for security

### 👥 Group Messages
- **Create Groups**: Create public or private groups
- **Group Management**: View members, invite users (private groups only)
- **Group Invitations**: Send/receive/respond to group invitations
- **Role-based Access**: Different permissions for group members

### 🔔 Notifications
- **Invitation Badges**: Red badge shows pending group invitations
- **Visual Feedback**: Immediate UI updates when actions are performed
- **Status Indicators**: Shows group privacy (lock/globe icons)

## Technical Implementation

### Backend APIs
```
/api/messages              - GET/POST direct messages
/api/groups/list          - GET user's groups
/api/groups/create        - POST create new group
/api/groups/[id]/messages - GET/POST group messages
/api/groups/[id]/members  - GET group members
/api/groups/[id]/invite   - POST invite user to group
/api/invitations          - GET pending invitations
/api/invitations/[id]/respond - POST accept/decline invitations
/api/users/list           - GET all users for DM selection
/api/users/available      - GET users available for group invitation
```

### Database Collections
- `pm` - Private messages (encrypted)
- `group_messages` - Group messages (encrypted)
- `groups` - Group information
- `group_members` - Group membership
- `group_invitations` - Group invitations
- `users` - User information
- `sessions` - Authentication sessions

### Frontend Components
- `UnifiedMessages.tsx` - Main component with Discord-like interface
- `Header.tsx` - Updated navigation with single "Chat" link
- `/chat` - New unified messaging page

## Usage

### Navigation
1. Click "Chat" in the sidebar to access unified messaging
2. Old "My Messages" and "My Groups" links are replaced with single "Chat" link

### Starting Conversations
1. **New DM**: Click user icon → select user → start conversation
2. **New Group**: Click group icon → fill form → create group
3. **Join Group**: Accept invitation or join public group

### Messaging
1. Select conversation from sidebar
2. Type message in input field
3. Press Enter or click send button
4. Messages auto-refresh every 3 seconds

### Group Management
1. **View Members**: Click users icon in group header
2. **Invite Users**: Click invite icon (private groups only)
3. **Accept/Decline Invitations**: Click bell icon → respond to invitations

## Security Features
- **Authentication**: All endpoints require valid session
- **Authorization**: Group-specific permissions enforced
- **Encryption**: Messages encrypted with AES encryption
- **Session Validation**: Server-side session verification

## UI/UX Features
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Consistent with app's dark theme
- **Smooth Animations**: Hover effects and transitions
- **Loading States**: Loading indicators for async operations
- **Error Handling**: User-friendly error messages

## Discord-like Elements
- **Sidebar Layout**: Conversations list on left, chat on right
- **Message Bubbles**: Different colors for own vs others' messages
- **User Avatars**: Placeholder avatars with icons
- **Timestamps**: Message timestamps shown
- **Channel Indicators**: # for groups, @ for DMs
- **Member Lists**: Group member management
- **Notification Badges**: Red badges for pending actions

## Future Enhancements
- **File Attachments**: Support for image/file sharing
- **Message Reactions**: Emoji reactions to messages
- **Typing Indicators**: Show when users are typing
- **Online Status**: Show user online/offline status
- **Message Search**: Search across all conversations
- **Push Notifications**: Browser notifications for new messages
- **Voice/Video Calls**: WebRTC integration
- **Message Threading**: Reply to specific messages
