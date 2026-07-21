/**
 * Generates `schema/unified-message-model.schema.json` from the Zod schemas so
 * non-TypeScript consumers get an authoritative, always-in-sync JSON Schema.
 *
 * Run with: `npm run schema:gen`
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  Contact,
  Conversation,
  Message,
  ConversationThread,
} from "../src/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../schema/unified-message-model.schema.json");

const schema = zodToJsonSchema(
  ConversationThread,
  {
    name: "ConversationThread",
    $refStrategy: "root",
    definitions: { Contact, Conversation, Message },
  },
);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
console.log(`Wrote ${out}`);
