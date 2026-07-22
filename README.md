# Starling

One inbox for your messages across iMessage, Instagram, WhatsApp, X/Twitter, and Telegram. Built for one person, not as a shared product. Looks and feels like a native Apple app.

For a detailed description of what Starling does and the experience it provides, see [PROJECT.md](./PROJECT.md).

## Roadmap

### Version 1
- **Platforms:** iMessage, Instagram
- **Features:** Read and reply to messages, conversation list with 30-day retention
- **Status:** In development

### Version 2
- **Platforms:** Add WhatsApp, X/Twitter, then Telegram
- **Features:** Same as v1, across more platforms
- **Status:** After v1 ships

### Version 3
- **Platforms:** All from v1 and v2
- **Features:** Reactions, read receipts, typing indicators, media support, search, adjustable retention window, merged contact view across platforms
- **Status:** After v2 ships

### Version 4
- **Platforms:** All platforms
- **Features:** Native SwiftUI apps for iOS and Mac; push notifications; web app continues as fallback
- **Status:** After v3 ships

For architecture and technical decisions behind each version, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Building

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Setup

```bash
npm install
```

### Running

```bash
npm start
```

### Testing

```bash
npm test
```

## Architecture

Starling is built as a monorepo with:

- **Frontend (v1–v3):** Custom web app (TypeScript/React)
- **Frontend (v4):** Native SwiftUI apps for iOS and Mac
- **Backend:** Platform integration layer connecting to iMessage (via BlueBubbles), Instagram, WhatsApp, X/Twitter, Telegram
- **Platform Registry:** Shared abstraction for platform identity (name, color, badge icon)
- **Data Model:** Unified message data model across all platforms

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Key Principles

- **Data Privacy:** All data stays local. Nothing leaves your hardware except traffic to the platforms themselves.
- **No Third-Party Services:** No relay servers, hosted middleware, or cloud dependencies in the data path.
- **Resource Efficient:** Built to run acceptably on a Mac Mini (Mid 2010, Intel Core 2 Duo).
- **One Person:** Built for individual use, not as a shared or public product.

## Development Workflow

Each version is assembled from independent modules, with human review after each version ships. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on the autonomous module-based development approach.
