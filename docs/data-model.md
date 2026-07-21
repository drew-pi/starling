# Unified Message Data Model

A **platform-agnostic** model for messages, conversations, and contacts. One
shape represents data from every supported platform. In v1 the supported
platforms are **iMessage** and **Instagram**, but nothing about the *structure*
is specific to either — adding a third platform means adding a value to the
`Platform` enum and writing a normalizer, not changing any entity's shape.

The schemas are defined once, in [`src/model.ts`](../src/model.ts), using
[Zod](https://zod.dev). The runtime validators and the exported TypeScript
types are the same definitions (types are `z.infer`-ed from the schemas), so they
cannot drift. A generated [JSON Schema](../schema/unified-message-model.schema.json)
is provided for non-TypeScript consumers.

## Design principles

1. **No platform branching in the shape.** The only platform-aware field is the
   `platform` tag (a plain discriminator) and an opaque `sourceIds` bag used to
   round-trip native identifiers. There is no `IMessageMessage` vs
   `InstagramMessage` — a single `Message` type covers both.
2. **One-on-one and group are the same structure.** A `Conversation` always has
   a `participantIds` list and a `kind` (`direct` | `group`). A direct chat is
   just a conversation with two participants; a group has more (and usually a
   `title`). Consumers never special-case platform to find "the other person".
3. **Platform-neutral timestamps.** Every time is a UTC instant encoded as an
   ISO-8601 string. Native encodings (Apple nanosecond epoch, Instagram
   microsecond epoch) are converted at ingest.
4. **Uniform content.** `MessageContent` carries `text` plus a list of
   `attachments`. A text-only message has empty `attachments`; a photo-only
   message has `text: ""`. The same field holds both.

## Entities

### `Platform`

Enum: `"imessage" | "instagram"`. The sole structural nod to platform identity.

### `Contact`

A participant identity, uniform across platforms.

| Field         | Type                  | Notes                                                        |
| ------------- | --------------------- | ------------------------------------------------------------ |
| `id`          | `string`              | Stable unified id assigned at ingest.                        |
| `platform`    | `Platform`            | Source platform.                                             |
| `handle`      | `string`              | Phone/email (iMessage) or username (Instagram). Same meaning: a human-addressable identifier. |
| `displayName` | `string \| null`      | Friendly name, when known.                                   |
| `avatarUrl`   | `string \| null`      | Avatar image URL, when known.                                |
| `isSelf`      | `boolean`             | True for the account owner ("me").                           |
| `sourceIds`   | `Record<string,string>` | Opaque native ids.                                         |

### `Conversation`

A thread between two or more contacts. **Identical shape for 1:1 and group.**

| Field            | Type                  | Notes                                              |
| ---------------- | --------------------- | -------------------------------------------------- |
| `id`             | `string`              | Unified id.                                        |
| `platform`       | `Platform`            | Source platform.                                   |
| `kind`           | `"direct" \| "group"` | Intent tag; does not change which fields exist.    |
| `title`          | `string \| null`      | Group name/subject. Usually null for direct chats. |
| `participantIds` | `string[]` (min 2)    | Contact ids, including self.                        |
| `createdAt`      | `Timestamp \| null`   | When the thread started, if known.                 |
| `sourceIds`      | `Record<string,string>` | Opaque native ids.                               |

### `Message`

A single message. The same object holds an iMessage text, an iMessage group
photo, or an Instagram DM.

| Field            | Type                  | Notes                                          |
| ---------------- | --------------------- | ---------------------------------------------- |
| `id`             | `string`              | Unified id.                                    |
| `platform`       | `Platform`            | Source platform.                               |
| `conversationId` | `string`              | Owning conversation.                           |
| `senderId`       | `string`              | Contact id of the sender (sender identity).    |
| `content`        | `MessageContent`      | Text + attachments.                            |
| `sentAt`         | `Timestamp`           | Authoritative ordering key (UTC, ISO-8601).    |
| `editedAt`       | `Timestamp \| null`   | When last edited, if ever.                     |
| `replyToId`      | `string \| null`      | Message this replies to, if any.               |
| `reactions`      | `Reaction[]`          | Tapbacks / emoji reactions.                    |
| `sourceIds`      | `Record<string,string>` | Opaque native ids.                            |

### `MessageContent`

| Field         | Type           | Notes                          |
| ------------- | -------------- | ------------------------------ |
| `text`        | `string`       | Empty string when none.        |
| `attachments` | `Attachment[]` | Empty list when none.          |

### `Attachment`

| Field      | Type                                                  | Notes                       |
| ---------- | ----------------------------------------------------- | --------------------------- |
| `id`       | `string`                                              | Unified id.                 |
| `kind`     | `"image" \| "video" \| "audio" \| "file" \| "link"`   | Coarse classification.      |
| `url`      | `string`                                              | Remote URL or storage path. |
| `mimeType` | `string \| null`                                      |                             |
| `fileName` | `string \| null`                                      |                             |
| `sizeBytes`| `number \| null`                                      |                             |

### `Reaction`

| Field       | Type        | Notes                                     |
| ----------- | ----------- | ----------------------------------------- |
| `actorId`   | `string`    | Contact id of the reactor.                |
| `emoji`     | `string`    | Reaction glyph normalized to an emoji.    |
| `reactedAt` | `Timestamp` | When applied.                             |

### `ConversationThread`

An export/import bundle: `{ conversation, contacts[], messages[] }`. The
`validateThread` helper checks referential integrity (senders and participants
resolve to contacts; messages belong to the conversation).

## How each platform maps in

Only the *normalizer* knows platform specifics; everything downstream sees one
shape. See [`test/model.test.ts`](../test/model.test.ts) for runnable examples.

| Concept         | iMessage source                          | Instagram source                       | Unified field         |
| --------------- | ---------------------------------------- | -------------------------------------- | --------------------- |
| Sender identity | `handle_id` (phone/email)                | `sender_id` (user id) / username       | `Message.senderId` → `Contact` |
| Conversation    | `chat_guid`                              | `thread_id`                            | `Conversation.id`     |
| 1:1 vs group    | participant count / `chat` style         | thread participant count               | `Conversation.kind`   |
| Timestamp       | Apple epoch (ns since 2001-01-01)        | µs since Unix epoch                    | `sentAt` (ISO-8601 UTC) |
| Text            | `message.text`                           | `item.text`                            | `content.text`        |
| Attachment      | `attachment` rows                        | `media` / `media_share`                | `content.attachments` |
| Reaction        | tapback (`associated_message_type`)      | emoji reaction                         | `reactions[]`         |

## Usage

```ts
import { Message, parseMessage, validateThread } from "unified-message-model";

const msg = parseMessage({
  id: "imessage:p:0/A1B2C3",
  platform: "imessage",
  conversationId: "imessage:chat123",
  senderId: "imessage:+15551234567",
  content: { text: "See you at 6!" },
  sentAt: "2026-07-19T05:00:00.000Z",
});

// Same schema validates an Instagram DM:
const dm = Message.safeParse({
  id: "instagram:aWc6MTIzNDU",
  platform: "instagram",
  conversationId: "instagram:340282366841710300949128149080034697420",
  senderId: "instagram:17841400000000001",
  content: {
    text: "check this out",
    attachments: [{ id: "a1", kind: "image", url: "https://.../photo.jpg" }],
  },
  sentAt: "2026-07-18T18:10:00.000Z",
});
```
