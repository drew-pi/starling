/**
 * Unified, platform-agnostic message data model.
 *
 * Design goals:
 *  - A single shape represents messages from any supported platform. The only
 *    platform-aware field is the {@link Platform} discriminator plus an opaque
 *    `sourceIds` bag for round-tripping native identifiers. Nothing about the
 *    *structure* changes per platform — there is no `iMessageMessage` vs
 *    `InstagramMessage`.
 *  - One-on-one and group conversations share one shape. A conversation always
 *    has a `participants` list and a `kind` discriminator; a direct chat is
 *    simply a conversation with two participants. Consumers never branch on
 *    platform to find the "other person".
 *  - Timestamps are platform-neutral: UTC instants encoded as ISO-8601 strings.
 *  - Message content is a uniform union of parts (text + attachments) so a
 *    photo DM and a plain text both fit the same field.
 *
 * The Zod schemas below are the single source of truth; the exported TypeScript
 * types are inferred from them so the runtime schema and the static types can
 * never drift.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The set of platforms understood by v1. This is the *only* place platform
 * identity leaks into the shape of the model; it is a plain tag, not a
 * structural discriminant.
 */
export const Platform = z.enum(["imessage", "instagram"]);
export type Platform = z.infer<typeof Platform>;

/** A UTC instant encoded as an ISO-8601 string, e.g. `2026-07-21T18:04:00.000Z`. */
export const Timestamp = z
  .string()
  .datetime({ offset: true })
  .describe("UTC instant, ISO-8601 encoded");
export type Timestamp = z.infer<typeof Timestamp>;

/**
 * Native identifiers from the source platform, kept opaque so the unified model
 * can be mapped back to the platform without growing platform-specific fields.
 * Keys are free-form (e.g. `guid`, `threadId`, `messageId`).
 */
export const SourceIds = z
  .record(z.string(), z.string())
  .describe("Opaque native identifiers, keyed by platform-defined name");
export type SourceIds = z.infer<typeof SourceIds>;

/* -------------------------------------------------------------------------- */
/* Contact                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A participant identity. Works for both platforms: `handle` is a phone number
 * or email for iMessage and a username for Instagram, but the field's *meaning*
 * (a human-addressable identifier) is uniform.
 */
export const Contact = z.object({
  /** Stable unified id assigned by the ingesting system. */
  id: z.string().min(1),
  platform: Platform,
  /**
   * Platform-addressable handle: phone/email (iMessage) or username (Instagram).
   */
  handle: z.string().min(1),
  /** Human-friendly name, when known. */
  displayName: z.string().nullable().default(null),
  /** URL to an avatar image, when known. */
  avatarUrl: z.string().url().nullable().default(null),
  /** True when this contact is the account owner (the "me" identity). */
  isSelf: z.boolean().default(false),
  sourceIds: SourceIds.default({}),
});
export type Contact = z.infer<typeof Contact>;

/* -------------------------------------------------------------------------- */
/* Message content                                                            */
/* -------------------------------------------------------------------------- */

/** Coarse attachment classification, uniform across platforms. */
export const AttachmentKind = z.enum([
  "image",
  "video",
  "audio",
  "file",
  "link",
]);
export type AttachmentKind = z.infer<typeof AttachmentKind>;

/** A single non-text piece of content (photo, clip, file, shared link, ...). */
export const Attachment = z.object({
  id: z.string().min(1),
  kind: AttachmentKind,
  /** Locator for the payload (remote URL or storage-relative path). */
  url: z.string().min(1),
  mimeType: z.string().nullable().default(null),
  fileName: z.string().nullable().default(null),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
});
export type Attachment = z.infer<typeof Attachment>;

/**
 * Uniform message body. Either or both of `text` and `attachments` may be
 * present; a text-only message has an empty `attachments` list and a
 * photo-only message has `text: ""`. No platform branching required.
 */
export const MessageContent = z.object({
  text: z.string().default(""),
  attachments: z.array(Attachment).default([]),
});
export type MessageContent = z.infer<typeof MessageContent>;

/* -------------------------------------------------------------------------- */
/* Reaction                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A reaction attached to a message (iMessage tapback or Instagram emoji react).
 * Both collapse to "an actor applied an emoji at a time".
 */
export const Reaction = z.object({
  /** Contact id of the reactor. */
  actorId: z.string().min(1),
  /** The reaction glyph, normalized to an emoji (e.g. `❤️`, `👍`). */
  emoji: z.string().min(1),
  reactedAt: Timestamp,
});
export type Reaction = z.infer<typeof Reaction>;

/* -------------------------------------------------------------------------- */
/* Conversation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `direct` = one-on-one, `group` = many. The *shape* is identical for both; the
 * discriminator exists for intent/UX, not to change which fields are present.
 */
export const ConversationKind = z.enum(["direct", "group"]);
export type ConversationKind = z.infer<typeof ConversationKind>;

/**
 * A thread of messages between two or more contacts. One-on-one and group chats
 * are the same structure — a group simply has more `participantIds` and usually
 * a `title`.
 */
export const Conversation = z.object({
  id: z.string().min(1),
  platform: Platform,
  kind: ConversationKind,
  /** Group name / subject. Null for most direct chats. */
  title: z.string().nullable().default(null),
  /** Contact ids of every participant, including self. */
  participantIds: z.array(z.string().min(1)).min(2),
  createdAt: Timestamp.nullable().default(null),
  sourceIds: SourceIds.default({}),
});
export type Conversation = z.infer<typeof Conversation>;

/* -------------------------------------------------------------------------- */
/* Message                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A single message. The same object shape holds an iMessage SMS, an iMessage
 * group photo, or an Instagram DM. Sender identity is a reference to a
 * {@link Contact}; timestamps are platform-neutral instants.
 */
export const Message = z.object({
  id: z.string().min(1),
  platform: Platform,
  /** Conversation this message belongs to. */
  conversationId: z.string().min(1),
  /** Contact id of the sender. */
  senderId: z.string().min(1),
  content: MessageContent,
  /** When the sender sent the message (authoritative ordering key). */
  sentAt: Timestamp,
  /** When last edited, if ever. */
  editedAt: Timestamp.nullable().default(null),
  /** Id of the message this one replies to, if any. */
  replyToId: z.string().min(1).nullable().default(null),
  reactions: z.array(Reaction).default([]),
  sourceIds: SourceIds.default({}),
});
export type Message = z.infer<typeof Message>;

/* -------------------------------------------------------------------------- */
/* Aggregate                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A self-contained bundle: the contacts, the conversation, and its messages.
 * Useful as an export/import unit and as a validation entry point.
 */
export const ConversationThread = z.object({
  conversation: Conversation,
  contacts: z.array(Contact),
  messages: z.array(Message),
});
export type ConversationThread = z.infer<typeof ConversationThread>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Parse + validate an unknown value as a {@link Message}, applying defaults. */
export const parseMessage = (input: unknown): Message => Message.parse(input);

/** Parse + validate an unknown value as a {@link Conversation}. */
export const parseConversation = (input: unknown): Conversation =>
  Conversation.parse(input);

/** Parse + validate an unknown value as a {@link Contact}. */
export const parseContact = (input: unknown): Contact => Contact.parse(input);

/**
 * Referential-integrity check for a bundle: every message's sender and the
 * conversation's participants must resolve to a contact in the bundle, and
 * every message must belong to the bundle's conversation. Returns the list of
 * problems (empty when the thread is internally consistent).
 */
export function validateThread(thread: ConversationThread): string[] {
  const problems: string[] = [];
  const contactIds = new Set(thread.contacts.map((c) => c.id));

  for (const pid of thread.conversation.participantIds) {
    if (!contactIds.has(pid)) {
      problems.push(`participant ${pid} has no matching contact`);
    }
  }

  const participantSet = new Set(thread.conversation.participantIds);
  for (const m of thread.messages) {
    if (m.conversationId !== thread.conversation.id) {
      problems.push(`message ${m.id} references foreign conversation`);
    }
    if (!contactIds.has(m.senderId)) {
      problems.push(`message ${m.id} sender ${m.senderId} has no contact`);
    } else if (!participantSet.has(m.senderId)) {
      problems.push(`message ${m.id} sender ${m.senderId} is not a participant`);
    }
  }

  return problems;
}
