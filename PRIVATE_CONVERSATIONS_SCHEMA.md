# MongoDB Schema: private_conversations

This collection stores metadata for each private conversation between two users.

## Fields

-   **`_id`**: `ObjectId` (Primary Key)
    -   Unique identifier for the conversation.
-   **`participant_ids`**: `Array<String>`
    -   An array containing exactly two unique `user_id` strings representing the participants in the conversation.
    -   To ensure a canonical document for any pair of users and simplify lookups, these IDs should be stored in a consistent order (e.g., lexicographically sorted).
    -   Example: `["user_id_A", "user_id_B"]` where `user_id_A` is lexicographically smaller than `user_id_B`.
    -   *Index this field for efficient querying.*
-   **`created_at`**: `ISODate`
    -   Timestamp indicating when the conversation was initiated (e.g., when the first message was sent).
-   **`updated_at`**: `ISODate`
    -   Timestamp indicating the last activity in the conversation (e.g., when the most recent message was sent or a status changed). This is useful for sorting conversations by recent activity.
    -   *Index this field for sorting.*

## Example Document

```json
{
  "_id": ObjectId("60c72b2f9b1d8c001f8e4c9a"),
  "participant_ids": ["user_f47ac10b", "user_834067ca"], // Assuming "user_834067ca" > "user_f47ac10b"
  "created_at": ISODate("2025-05-20T10:00:00.000Z"),
  "updated_at": ISODate("2025-05-24T12:48:15.469Z")
}
```

## Indexes

-   Ensure an index on `participant_ids` for fast lookups of conversations between two specific users:
    `db.private_conversations.createIndex({ participant_ids: 1 })`
-   Consider an index on `updated_at` for efficiently fetching recently active conversations:
    `db.private_conversations.createIndex({ updated_at: -1 })`
