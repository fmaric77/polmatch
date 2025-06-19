# Voice Calling Setup Instructions

## Prerequisites

1. **Agora Account Setup**
   - Go to https://www.agora.io/
   - Sign up for a free account
   - Create a new project in the Agora Console
   - Copy the App ID from your project

2. **Environment Configuration**
   - Open `.env.local` file
   - Replace `your_agora_app_id_here` with your actual Agora App ID:
     ```
     NEXT_PUBLIC_AGORA_APP_ID=your_actual_app_id_here
     ```

## Features Implemented

### 🎯 Voice Call Button
- Added a green phone icon button in direct message conversations
- Button appears in the chat header next to the user's profile picture
- Only visible in direct (1-on-1) conversations, not in group chats

### 📞 Voice Call Modal
- Clean, FBI-style dark interface matching the app's design
- Shows caller/recipient information
- Real-time call duration counter
- Mute/unmute functionality
- End call button

### 🔄 Call Management API
- `POST /api/voice-calls` - Initiate a call
- `GET /api/voice-calls` - Check for incoming calls
- `PATCH /api/voice-calls` - Accept/decline/end calls

### 🎨 Smart Polling
- Intelligent polling frequency based on call activity
- Reduces API calls when tab is not visible
- Debouncing to prevent excessive requests

## How to Use

### Starting a Call
1. Open a direct message conversation
2. Click the green phone icon (📞) in the chat header
3. The voice call modal will open
4. Agora will handle the voice connection

### Receiving a Call
1. When someone calls you, a modal will appear
2. Click the green phone button to accept
3. Click the red phone button to decline

### During a Call
- Click the microphone button to mute/unmute
- Click the red phone button to end the call
- Call duration is displayed in real-time

## Technical Details

### Channel Naming
- Generates Agora-compliant channel names (alphanumeric, under 64 bytes)
- Consistent naming regardless of who initiates the call
- Removes hyphens and uses hash-based naming for UUID compatibility

### Security
- All API endpoints require authentication
- Session validation using existing auth system
- Call notifications stored in MongoDB with proper user validation

### Performance Optimizations
- Intelligent polling (30s normal, 10s with active calls, 2min when tab hidden)
- Request debouncing (minimum 5 seconds between API calls)
- Tab visibility detection to reduce background polling

## Testing

1. Make sure you have a valid Agora App ID in `.env.local`
2. Start the development server: `npm run dev`
3. Login with two different user accounts in separate browser windows
4. Start a direct message conversation
5. Click the phone icon to test voice calling

## Troubleshooting

### Common Issues

1. **"NEXT_PUBLIC_AGORA_APP_ID environment variable is not set"**
   - Make sure you've added your Agora App ID to `.env.local`
   - Restart the development server after changing environment variables

2. **"Invalid Channel Name" error**
   - This should be fixed with the new channel naming system
   - Channel names are now alphanumeric and under 64 bytes

3. **Microphone permissions**
   - Make sure to allow microphone access when prompted by the browser
   - Voice calls require microphone permissions to work

4. **No incoming call notifications**
   - Check that the polling is working (you should see GET requests to `/api/voice-calls`)
   - Make sure both users are logged in and have valid sessions

## Future Enhancements

- Real-time call notifications via WebSocket (instead of polling)
- Video calling support
- Call history and missed call notifications
- Group voice calls
- Screen sharing capabilities
- Call recording (with proper permissions)

## API Reference

### POST /api/voice-calls
```json
{
  "recipient_id": "user_id_here",
  "channel_name": "generated_channel_name",
  "call_type": "voice"
}
```

### GET /api/voice-calls
Returns pending incoming calls for the authenticated user.

### PATCH /api/voice-calls
```json
{
  "call_id": "call_id_here",
  "status": "accepted|declined|ended|missed"
}
```
