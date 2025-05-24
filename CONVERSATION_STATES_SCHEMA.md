// Conversation States Collection Schema
// This collection tracks the visibility state of conversations for each user

/*
Collection: conversation_states
Schema: {
  "conversation_id": "string", // Unique identifier for the conversation
  "user_id": "string",         // User who owns this state
  "other_user_id": "string",   // The other participant (for DMs)
  "conversation_type": "string", // "direct" or "group" 
  "state": "string",           // "visible" or "hidden"
  "created_at": "datetime",    // When conversation was first created
  "updated_at": "datetime",    // When state was last changed
  "last_message_at": "datetime" // For sorting conversations
}

Index: 
- { user_id: 1, other_user_id: 1, conversation_type: 1 } (unique)
- { user_id: 1, state: 1, last_message_at: -1 }
*/

// Example documents:
[
  {
    "conversation_id": "user1_user2_direct",
    "user_id": "user1", 
    "other_user_id": "user2",
    "conversation_type": "direct",
    "state": "visible",
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-01T10:00:00Z", 
    "last_message_at": "2024-01-01T15:30:00Z"
  },
  {
    "conversation_id": "user2_user1_direct", 
    "user_id": "user2",
    "other_user_id": "user1", 
    "conversation_type": "direct",
    "state": "hidden",
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z",
    "last_message_at": "2024-01-01T15:30:00Z" 
  }
]
