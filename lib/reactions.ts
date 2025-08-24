// Lightweight client-side emoji reactions control messages and helpers.
// Control message format: REACT:v1:<targetId>:<emoji>:<op>
// - targetId: string message id (DM: _id; Group: message_id)
// - emoji: a single unicode emoji
// - op: add | remove

export type ReactionOp = 'add' | 'remove';
export interface ReactionsState {
  // messageId -> emoji -> array of userIds
  [messageId: string]: {
    [emoji: string]: string[];
  };
}

const REACT_PREFIX = 'REACT:v1:';

export const reactions = {
  prefix(): string {
    return REACT_PREFIX;
  },
  build(targetId: string, emoji: string, op: ReactionOp): string {
    return `${REACT_PREFIX}${encodeURIComponent(targetId)}:${encodeURIComponent(emoji)}:${op}`;
  },
  isReactionControl(content: string): boolean {
    return typeof content === 'string' && content.startsWith(REACT_PREFIX);
  },
  parse(content: string): { targetId: string; emoji: string; op: ReactionOp } | null {
    if (!this.isReactionControl(content)) return null;
    const rest = content.slice(REACT_PREFIX.length);
    const parts = rest.split(':');
    if (parts.length < 3) return null;
    const [rawId, rawEmoji, op] = parts;
    if (op !== 'add' && op !== 'remove') return null;
    try {
      const targetId = decodeURIComponent(rawId);
      const emoji = decodeURIComponent(rawEmoji);
      return { targetId, emoji, op };
    } catch {
      return null;
    }
  },
  // Apply a reaction change to a state object (immutable update)
  apply(
    prev: ReactionsState,
    messageId: string,
    emoji: string,
    userId: string,
    op: ReactionOp
  ): ReactionsState {
    const messageReacts = prev[messageId] || {};
    const users = new Set<string>(messageReacts[emoji] || []);
    if (op === 'add') {
      users.add(userId);
    } else {
      users.delete(userId);
    }
    const updatedEmojiUsers = Array.from(users);
    const updatedMsg = { ...messageReacts };
    if (updatedEmojiUsers.length === 0) {
      delete updatedMsg[emoji];
    } else {
      updatedMsg[emoji] = updatedEmojiUsers;
    }
    const next = { ...prev, [messageId]: updatedMsg };
    // If message has no emojis left, remove the entry
    if (Object.keys(next[messageId]).length === 0) {
      const copy: ReactionsState = { ...next };
      delete copy[messageId];
      return copy;
    }
    return next;
  },
};

export default reactions;
