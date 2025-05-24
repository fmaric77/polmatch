# MongoDB Schema: pms (Private Messages)

This collection stores individual private messages. It will be linked to the `private_conversations` collection.

## Fields

-   **`_id`**: `ObjectId` (Primary Key)
    -   Unique identifier for the message.
-   **`conversation_id`**: `ObjectId`
    -   Foreign key referencing the `_id` in the `private_conversations` collection to which this message belongs.
    -   *Index this field for efficient retrieval of all messages within a specific conversation.*
-   **`sender_id`**: `String`
    -   The `user_id` of the user who sent the message.
    -   *Index this field if you need to query messages sent by a specific user across different conversations, though `conversation_id` will be the primary query path.*
-   **`receiver_id`**: `String` (Potentially Redundant / Denormalization)
    -   The `user_id` of the user who received the message.
    -   While the `conversation_id` already defines the participants, including `receiver_id` can simplify some queries or client-side logic if you often need to know the recipient without looking up the conversation document. However, it introduces data redundancy. If `conversation_id` is always used to fetch messages, this might be omitted to strictly normalize.
-   **`content`**: `String`
    -   The text content of the message. This should be encrypted.
-   **`timestamp`**: `ISODate`
    -   Timestamp indicating when the message was sent.
    -   *Index this field within the scope of `conversation_id` for sorting messages chronologically: `db.pms.createIndex({ conversation_id: 1, timestamp: 1 })`*
-   **`read`**: `Boolean`
    -   Indicates whether the message has been read by the recipient.
    -   This might be better managed per-user per-message if a message can be part of a group chat later, or if read status needs to be tracked for both participants in a 2-person chat (e.g. read by sender, read by receiver). For simple 1-to-1, this boolean might suffice if it means "read by the other participant".
    -   Consider moving read status to a separate collection or embedding it within the `conversation_states` if it needs to be user-specific for each message.
-   **`attachments`**: `Array<String>`
    -   An array of URLs or identifiers for any attachments included with the message.

## Example Document

```json
{
  "_id": ObjectId("6831c00f0da622d843fac2c2"),
  "conversation_id": ObjectId("60c72b2f9b1d8c001f8e4c9a"), // Links to the private_conversations document
  "sender_id": "user_f47ac10b",
  "receiver_id": "user_834067ca", // Recipient
  "content": "U2FsdGVkX180TfOGGiuOfo7PqrISw8PMizLivWunYug=", // Encrypted message
  "timestamp": ISODate("2025-05-24T12:48:15.469Z"),
  "read": true,
  "attachments": []
}
```

## Indexes

-   Primary index for fetching messages for a conversation:
    `db.pms.createIndex({ conversation_id: 1, timestamp: 1 })` (Compound index for querying by conversation and sorting by time)
-   Optional: `db.pms.createIndex({ sender_id: 1 })`
-   Optional: `db.pms.createIndex({ timestamp: -1 })` (If you need to query recent messages globally, though less common for pms)

## Relationship to `private_conversations`

-   When a new private message is sent between two users for the first time:
    1.  A new document is created in `private_conversations` for that pair of users.
    2.  The `_id` of this new `private_conversations` document is then used as the `conversation_id` for the message stored in the `pms` collection.
-   Subsequent messages between the same two users will reuse the existing `conversation_id`.

## Considerations for `read` status:

The current `read` field is a simple boolean. If you need more granular read status (e.g., knowing if *each* participant has read a message, especially if you ever extend to group-like features, or want to show separate read receipts), you might need a more complex structure:

-   **Option A (Embedded in Message):**
    ```json
    "read_by": ["user_id_who_read_it_1", "user_id_who_read_it_2"]
    ```
-   **Option B (Separate Collection):** `message_read_statuses` collection linking `message_id`, `user_id`, and `read_at` timestamp.

For now, the simple boolean `read` implies it has been read by the *other* participant in the conversation. The `PATCH /api/messages` endpoint (which marks messages as read) would set this to `true` when the recipient views the message.
