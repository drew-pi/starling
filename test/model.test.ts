import { describe, it, expect } from "vitest";
import {
  Contact,
  Conversation,
  Message,
  ConversationThread,
  parseMessage,
  validateThread,
  type Message as MessageT,
  type ConversationThread as ThreadT,
} from "../src/model.js";

/**
 * These tests are the proof obligation for the goal: the *same* schema and the
 * *same* object shape represent a message from each v1 platform, covering both
 * one-on-one and group conversations, with no platform-specific branching in
 * the data itself. The only platform-aware field is the `platform` tag.
 *
 * To make the point concretely, each platform's raw native payload is shown and
 * normalized into the unified model. The normalizers are the *only* code that
 * knows platform specifics; everything downstream consumes one uniform shape.
 */

/* ----------------------------- iMessage input ---------------------------- */
// Shape roughly mirrors rows from the iMessage `chat.db` SQLite store.
const rawIMessage = {
  guid: "p:0/A1B2C3",
  chat_guid: "iMessage;+;chat123",
  handle_id: "+15551234567",
  text: "See you at 6!",
  // Apple epoch: nanoseconds since 2001-01-01. This is a real conversion.
  date: 774_814_800_000_000_000n, // 2025-07-19T05:00:00Z-ish
  is_from_me: 0,
};

function normalizeIMessage(raw: typeof rawIMessage): MessageT {
  const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1);
  const sentMs = APPLE_EPOCH_MS + Number(raw.date / 1_000_000n);
  return parseMessage({
    id: `imessage:${raw.guid}`,
    platform: "imessage",
    conversationId: `imessage:${raw.chat_guid}`,
    senderId: `imessage:${raw.handle_id}`,
    content: { text: raw.text },
    sentAt: new Date(sentMs).toISOString(),
    sourceIds: { guid: raw.guid, chatGuid: raw.chat_guid },
  });
}

/* ---------------------------- Instagram input ---------------------------- */
// Shape roughly mirrors Instagram's data-export / Graph DM item JSON.
const rawInstagram = {
  item_id: "aWc6MTIzNDU",
  thread_id: "340282366841710300949128149080034697420",
  sender_id: "17841400000000001",
  item_type: "media_share",
  text: "check this out",
  media: {
    type: "image",
    url: "https://scontent.cdninstagram.com/v/photo.jpg",
    mime: "image/jpeg",
  },
  timestamp: "1721326200000000", // microseconds since Unix epoch
};

function normalizeInstagram(raw: typeof rawInstagram): MessageT {
  const sentMs = Math.floor(Number(raw.timestamp) / 1000);
  return parseMessage({
    id: `instagram:${raw.item_id}`,
    platform: "instagram",
    conversationId: `instagram:${raw.thread_id}`,
    senderId: `instagram:${raw.sender_id}`,
    content: {
      text: raw.text,
      attachments: raw.media
        ? [
            {
              id: `instagram:${raw.item_id}:media`,
              kind: "image",
              url: raw.media.url,
              mimeType: raw.media.mime,
            },
          ]
        : [],
    },
    sentAt: new Date(sentMs).toISOString(),
    sourceIds: { itemId: raw.item_id, threadId: raw.thread_id },
  });
}

describe("unified model represents both v1 platforms", () => {
  it("normalizes an iMessage into the model", () => {
    const msg = normalizeIMessage(rawIMessage);
    expect(msg.platform).toBe("imessage");
    expect(msg.content.text).toBe("See you at 6!");
    expect(() => Message.parse(msg)).not.toThrow();
  });

  it("normalizes an Instagram DM (with attachment) into the model", () => {
    const msg = normalizeInstagram(rawInstagram);
    expect(msg.platform).toBe("instagram");
    expect(msg.content.attachments).toHaveLength(1);
    expect(msg.content.attachments[0]?.kind).toBe("image");
    expect(() => Message.parse(msg)).not.toThrow();
  });

  it("produces the SAME object shape for both platforms", () => {
    const a = normalizeIMessage(rawIMessage);
    const b = normalizeInstagram(rawInstagram);
    // Structural equality of keys: no platform-specific fields exist.
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  it("both validate against one and the same schema", () => {
    // A single validator handles either platform — no branching.
    const validate = (raw: unknown) => Message.safeParse(raw);
    expect(validate(normalizeIMessage(rawIMessage)).success).toBe(true);
    expect(validate(normalizeInstagram(rawInstagram)).success).toBe(true);
  });
});

describe("one-on-one and group conversations share one shape", () => {
  const self = Contact.parse({
    id: "self",
    platform: "imessage",
    handle: "+15550000000",
    isSelf: true,
  });
  const alice = Contact.parse({
    id: "imessage:+15551234567",
    platform: "imessage",
    handle: "+15551234567",
    displayName: "Alice",
  });
  const bob = Contact.parse({
    id: "imessage:+15559876543",
    platform: "imessage",
    handle: "+15559876543",
    displayName: "Bob",
  });

  it("represents a direct (1:1) conversation", () => {
    const direct = Conversation.parse({
      id: "imessage:iMessage;+;chat123",
      platform: "imessage",
      kind: "direct",
      participantIds: [self.id, alice.id],
    });
    expect(direct.kind).toBe("direct");
    expect(direct.participantIds).toHaveLength(2);
  });

  it("represents a group conversation with the identical shape", () => {
    const group = Conversation.parse({
      id: "imessage:iMessage;+;chat999",
      platform: "imessage",
      kind: "group",
      title: "Weekend Plans",
      participantIds: [self.id, alice.id, bob.id],
    });
    expect(group.kind).toBe("group");
    expect(group.participantIds).toHaveLength(3);
    // Same keys as a direct conversation — group-ness is data, not shape.
    const direct = Conversation.parse({
      id: "imessage:iMessage;+;chat123",
      platform: "imessage",
      kind: "direct",
      participantIds: [self.id, alice.id],
    });
    expect(Object.keys(group).sort()).toEqual(Object.keys(direct).sort());
  });

  it("cross-platform group: an Instagram group thread uses the same shape", () => {
    const igGroup = Conversation.parse({
      id: "instagram:340282366841710300949128149080034697420",
      platform: "instagram",
      kind: "group",
      title: "Trip crew",
      participantIds: ["self", "instagram:17841400000000001", "instagram:17841400000000002"],
    });
    const imGroup = Conversation.parse({
      id: "imessage:iMessage;+;chat999",
      platform: "imessage",
      kind: "group",
      title: "Weekend Plans",
      participantIds: [self.id, alice.id, bob.id],
    });
    expect(Object.keys(igGroup).sort()).toEqual(Object.keys(imGroup).sort());
  });
});

describe("thread bundle validation", () => {
  it("accepts an internally consistent cross-platform-agnostic thread", () => {
    const thread: ThreadT = ConversationThread.parse({
      conversation: {
        id: "instagram:thread-1",
        platform: "instagram",
        kind: "group",
        title: "Trip crew",
        participantIds: ["self", "instagram:u1", "instagram:u2"],
      },
      contacts: [
        { id: "self", platform: "instagram", handle: "me", isSelf: true },
        { id: "instagram:u1", platform: "instagram", handle: "u1" },
        { id: "instagram:u2", platform: "instagram", handle: "u2" },
      ],
      messages: [
        {
          id: "instagram:m1",
          platform: "instagram",
          conversationId: "instagram:thread-1",
          senderId: "instagram:u1",
          content: { text: "hi all" },
          sentAt: "2026-07-18T12:00:00.000Z",
        },
      ],
    });
    expect(validateThread(thread)).toEqual([]);
  });

  it("flags a message whose sender is not a participant", () => {
    const thread: ThreadT = ConversationThread.parse({
      conversation: {
        id: "imessage:c1",
        platform: "imessage",
        kind: "direct",
        participantIds: ["self", "imessage:a"],
      },
      contacts: [
        { id: "self", platform: "imessage", handle: "+1", isSelf: true },
        { id: "imessage:a", platform: "imessage", handle: "+2" },
        { id: "imessage:stranger", platform: "imessage", handle: "+3" },
      ],
      messages: [
        {
          id: "imessage:m1",
          platform: "imessage",
          conversationId: "imessage:c1",
          senderId: "imessage:stranger",
          content: { text: "how did I get here" },
          sentAt: "2026-07-18T12:00:00.000Z",
        },
      ],
    });
    expect(validateThread(thread)).toContain(
      "message imessage:m1 sender imessage:stranger is not a participant",
    );
  });
});
