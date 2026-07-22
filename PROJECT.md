# Starling — what it does

This describes the experience only — what you see and what you can do. Nothing here
is about how it's built. Read this in full before treating any part of it as settled.

## Overview

Starling is one inbox for your messages, starting with iMessage and Instagram, so
you can read and reply without opening separate apps. Built for one person (you),
not as a shared or public product. Should look and feel like a native Apple app,
even in its first form as a web app. Versions 1 through 3 are all that web app —
nothing native exists until version 4. There's no in-between step where part of it
is a web app and part of it isn't.

## Version 1

**Platforms:** iMessage, Instagram.

**Look and feel:** styled like a native Mac/iOS app — system fonts, a sidebar list
next to an open conversation on wide screens (like Mail or Messages on a Mac),
collapsing to a single full-screen conversation with a back button on narrow screens
(like Messages on iPhone). Sent messages appear in the iOS blue bubble; received
messages use a neutral bubble that adapts to light or dark mode automatically.

**Conversations:**
- Both one-on-one and group conversations work
- Every conversation is its own row in the list, always visible — nothing is ever
  hidden or combined in v1
- Each row has a distinct color accent showing which platform it's from
- Every conversation shows the person's real name and photo, pulled from your
  contacts, instead of a raw phone number or username
- Messages are kept for 30 days from when they arrive, then automatically removed
  from Starling — a fixed, non-adjustable window in v1 and v2. This only affects
  Starling's own copy; the original conversation stays exactly where it's always
  been on WhatsApp, Instagram, and every other connected platform

**What you can do:**
- See your list of conversations
- Open a conversation and read its message history
- See new messages appear as they arrive, without needing to refresh
- Send a plain text reply
- See a basic unread indicator (bold name plus a dot) on conversations with
  something new

**Deliberately not in v1:**
- Photos or other non-text messages show only as a placeholder, not fully displayed
- No read receipts, typing indicators, or reactions
- No search
- No sending photos or other media
- No AI features of any kind — no summaries, no suggested replies
- No push notifications — the app has to be open to see new messages
- No merged/combined view of the same person across platforms — that's v3

## Version 2

Still the same web app — no native app yet, that's v4.

Adds more platforms, in this order: WhatsApp, then X/Twitter, then Telegram. TikTok
is not included — no way to connect it exists yet, and it's only added if that
changes.

Everything else stays at the same depth as v1 — this version is about reaching more
platforms, not adding new capabilities.

## Version 3

Still the same web app — no native app yet, that's v4.

**New capabilities across all connected platforms, wherever each platform allows it:**
- Reactions
- Read receipts
- Typing indicators
- Sending and viewing photos and other media
- Search across every conversation
- The 30-day retention window becomes an adjustable setting instead of a fixed
  limit

**Merged view for the same person across platforms:**
- If a person messages you on more than one platform, their conversations can
  collapse into a single row
- That row uses one shared color for the person rather than a platform-specific
  color, plus a small badge on their photo showing which platform is currently
  being shown
- It shows whichever platform that person was most recently active on
- If a new message arrives on a different platform than the one currently shown,
  that platform's conversation reappears as its own separate row — in its own
  normal platform color, exactly like v1 — until you've read it, then it folds
  back into the single merged row
- When replying to a merged conversation, you choose between two ways of working:
  - Replies follow whichever platform the person was most recently active on, and
    the app always shows you which platform it's about to send to before you send,
    so you can change it if you want
  - Or, that person's conversations stay visually separate per platform (the v1
    approach), and replying happens within whichever specific platform's
    conversation you have open
- This merged view only applies to one-on-one conversations. Group conversations
  are never merged, even if some members overlap across platforms.

## Version 4

- Fully native apps for iOS and Mac, built separately from the web app rather than
  wrapping it, with the same capabilities as version 3
- Push notifications
- The web app continues to exist and work, as a fallback and for use on non-Apple
  devices
