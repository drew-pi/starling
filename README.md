# unified-message-model

A **platform-agnostic** message / conversation / contact data model that
represents messages from multiple messaging platforms with a single shape. v1
supports **iMessage** and **Instagram** — but there is no platform-specific
branching in the model's structure. The only platform-aware field is a plain
`platform` tag; adding a platform means adding an enum value and a normalizer,
not changing any entity.

- **Schema + types from one source.** Entities are defined once as
  [Zod](https://zod.dev) schemas in [`src/model.ts`](src/model.ts); the exported
  TypeScript types are inferred from them, so validation and types never drift.
- **Handles 1:1 and group chats with one shape.** A `Conversation` has a
  `participantIds` list and a `kind` (`direct` | `group`). A direct chat is just
  two participants; a group has more. Same fields either way.
- **Platform-neutral timestamps** (UTC, ISO-8601) and **uniform content**
  (`text` + `attachments`).
- **JSON Schema** for non-TS consumers at
  [`schema/unified-message-model.schema.json`](schema/unified-message-model.schema.json),
  generated from the Zod schemas.

## Layout

```
src/model.ts     Zod schemas + inferred types (the model)
src/index.ts     Public exports
schema/*.json    Generated JSON Schema
docs/data-model.md   Full field reference and platform mapping
test/model.test.ts   Unit tests proving one model spans both platforms
scripts/         JSON Schema generator
```

## Develop

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run schema:gen  # regenerate JSON Schema from the Zod schemas
```

## Proof

The unit tests take a raw native payload from **each** v1 platform, normalize
each into the unified model, and assert that:

- both validate against the **same** schema,
- both produce the **same object shape** (identical keys — no platform fields),
- one-on-one and group conversations share the identical shape.

See [`test/model.test.ts`](test/model.test.ts) and
[`docs/data-model.md`](docs/data-model.md).
