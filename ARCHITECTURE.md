# Starling — architecture and technical decisions

Technical companion to PROJECT.md. This file is for whoever (or whatever agent) is
building this — it has no bearing on user-facing behavior, which lives entirely in
PROJECT.md. Read both before starting any task.

## Non-negotiable principles (fixed, not open for reinterpretation)

These hold regardless of which technical approach gets chosen below:

- No paid APIs, ever, for any platform integration
- All data stays local — nothing leaves your own hardware except the unavoidable
  traffic to the platforms themselves (WhatsApp/Instagram/etc.'s own servers,
  since that's who you're actually messaging)
- No third-party servers or services in the data path — no relay, no vendor cloud,
  no hosted middleware of any kind. This is about Starling's own runtime data —
  messages and contacts — not the project's source code. The source repo lives on
  a private GitHub repo (see Development workflow below); that's a different, much
  lower-stakes kind of data than a message from someone's phone.
- Production hardware is the Mac Mini (Mid 2010, Intel Core 2 Duo) — whatever gets
  chosen has to actually run acceptably on that machine, not just in theory
- Prefer less code and fewer moving parts when a genuine choice exists
- No platform-specific branching in the frontend — go through a shared
  platform-identity lookup (name, color, badge icon per platform), whatever
  supplies the underlying data

## Platform integration approach — open research question, not a locked decision

How each platform actually gets connected is intentionally left open. What follows
is what came out of one research pass — real, current options with their tradeoffs,
not an exhaustive survey and not a recommendation. Whoever picks this up (ideally a
frontier model with the ability to check what's actively maintained at the time of
building) should treat this as a starting point to verify and expand on, not a
menu to pick blindly from.

### Candidate: self-hosted Matrix homeserver + community bridges

Run a self-hosted Matrix server, with a separate open-source bridge per platform
translating that platform's messages into it. This is the architecture Beeper and
Texts are actually built on.

- **Pros:** the most mature, most battle-tested reverse-engineering work available
  per platform — the same bridges a company runs its product on. Active maintenance
  community. If more platforms get added later, several already have existing
  bridges, which is less new work than building a connector from nothing.
- **Cons:** the homeserver is the single heaviest component in the entire stack,
  and it's carrying that weight on the most resource-constrained machine in the
  plan. The lightweight homeserver alternatives don't support bridges at all, so
  this path means committing to the heaviest implementation available. Also worth
  naming honestly: Matrix's own protocol (encryption, federation, multi-client sync)
  goes almost entirely unused here, since the plan is a single custom frontend for
  one person — its overhead is being paid for without using what it's for.
- **Resource shape:** meaningful RAM and CPU overhead just to keep the homeserver
  running, on top of whatever each bridge process costs individually.

### Candidate: direct platform libraries, no homeserver

Skip Matrix entirely. Talk to each platform's own reverse-engineered protocol
directly, through an actively maintained library, and store everything in your own
lightweight local storage.

- Known options as of this research: `whatsmeow` (Go) or `Baileys` (TypeScript) for
  WhatsApp — both are the same category of library the WhatsApp bridge above is
  itself built on, just usable standalone; `instagrapi` (Python) for Instagram,
  covering direct messages directly.
- **Pros:** no homeserver process at all, which removes the heaviest single
  component outright. Each piece only does what's actually needed. You own the data
  model from day one instead of adapting to Matrix's room/event structure.
- **Cons:** no single shared abstraction across platforms — this is N separate
  libraries in different languages with different conventions, rather than one
  consistent bridge framework, so there's more integration surface area to keep
  working over time. Smaller support community for this specific combination, since
  it isn't a packaged product anyone else runs as-is.
- **Resource shape:** generally lighter than the homeserver path — these libraries
  are built to run standalone, without an extra always-on service coordinating them.

### Candidate: browser-based wrapper

Embed each platform's own official web app in its own view, side by side — the
approach apps like Franz, Rambox, and Shift take. No protocol integration at all.

- **Pros:** by far the least code of any option. No reverse-engineering, no
  protocol-break risk, since it's just the platforms' own web clients running as-is.
- **Cons:** no structured access to the underlying messages, which means no way to
  build the merged-contact view, search, or the custom bubble UI already described
  in PROJECT.md — this approach produces a different kind of product than the one
  specified there. Also worth naming honestly on the resource side: this isn't
  automatically the lightest option just because it's the least code — each
  embedded platform is a real browser session running underneath, and several of
  those side by side can use as much or more memory than the other two approaches.

### iMessage is the one constant across all three

Regardless of which of the above gets chosen for WhatsApp/Instagram/X, iMessage
access itself goes through BlueBubbles running natively on the Mac Mini — that's
the standard tool for this specific job either way, not part of the open question.
Its Private API needs to be enabled from day one (required for v1's group chat
support), which means System Integrity Protection is disabled on the Mac Mini from
the start, not deferred.

This list is not exhaustive. It reflects one research pass at one point in time —
there may be better or newer options by the time this gets built, and finding out
is worth real effort before committing.

## Frontend

- **v1–v3:** custom-built web app, not a reskin of any existing client
- **v4:** fully native SwiftUI apps for iOS and Mac, built as a second client, not
  a wrapper around the web app
- **Dev machine:** M1 MacBook (Apple Silicon)
- **Production machine:** Mac Mini, Mid 2010. Development and deployment both
  happen from source, not pre-built binaries, so moving between the two is a
  clone-and-build step, not a binary copy
- iMessage requires BlueBubbles plus likely OpenCore Legacy Patcher on the Mac Mini
  to reach a modern-enough macOS version

## Platform rollout order (independent of which integration approach is chosen)

- **v1:** iMessage, Instagram
- **v2:** WhatsApp, then X/Twitter, then Telegram, in that order
- **Not currently planned:** TikTok has no viable integration path of any kind as
  of this research; revisit only if that changes

## Resource constraints

Cap CPU and memory for every service in local development to match the Mac Mini's
real limits, not the M1's. Until the Mac Mini's actual specs are confirmed (check
About This Mac), default to a conservative ceiling of 2 CPUs / 4GB RAM total across
the whole stack, and build against that ceiling from day one. Which platform
integration approach gets chosen above directly affects how tight this budget is —
worth reconfirming actual headroom once that decision is made.

## Development workflow

### Human checkpoints happen between versions, not between modules

Within a version, modules run fully autonomously, one after another, with no
review step in between. The one point where a human looks at anything is after
every module for a version is complete — reviewing the assembled, working version
before the next one starts. Everything below exists to make that autonomous
stretch trustworthy enough to actually leave unattended.

### The autonomous loop

Each module is scoped like "connect Instagram and confirm a message arrives," not
"build the app," and runs as a `/goal`-driven session: a completion condition is
set once, and Claude keeps working turn after turn — no prompting in between —
until a separate evaluator confirms the condition holds against what's actually
been demonstrated in the conversation, not just asserted. Paired with auto mode
(which removes per-tool approval prompts, backed by a classifier that still blocks
genuinely risky actions), this is what makes a module actually unattended rather
than just infrequently-prompted.

The condition itself has to be provable, not assertable — "the bridge is running"
is weak, "`docker compose ps` shows it healthy and a test message appears in the
Matrix room within 10 seconds" is strong, because Claude has to produce that
evidence for the evaluator to see. This is the same verification principle as
before, just with a concrete mechanism to plug into.

At the start of each version, Sonnet reads `PROJECT.md` and this file and breaks
the version into an ordered list of goal conditions, respecting dependencies
(a homeserver has to exist before a bridge config does), saved to a file. A
script then chains through that list automatically — the same fan-out pattern as
looping `claude -p` over a batch of files — so a whole version runs unattended
goal after goal, not just one goal at a time with a human restarting each one.

### Two model families, used deliberately

Fable (Claude Code) is the primary builder. OpenAI's Codex — via its official
plugin for Claude Code — provides a second opinion from a genuinely different
model family for two specific jobs: adversarial review of a module's diff before
it merges, and as a fallback ("rescue") that keeps work moving on its own,
separate ChatGPT quota if Claude's runs out mid-module. The point of the second
model isn't redundancy — a model reviewing its own reasoning tends to miss the
same things it got wrong the first time, since it's sampling from the same
distribution that produced the mistake. A different model, trained differently,
doesn't share that blind spot.

Both Fable and Codex here run on ordinary subscription plans (Claude Pro, ChatGPT
Plus), not pay-per-token API access — deliberately, to avoid quietly introducing a
paid API dependency into a project whose whole premise is avoiding those. This is
a hard rule, not just a default: no step in this workflow, including PR review,
ever falls back to API billing. Everything routes through the two subscriptions.

### Model tiering, to make the subscription quota last

Fable is reserved for goals where getting the design wrong is expensive to
unwind — the unified message data model, the platform registry abstraction, the
v3 contact-merging logic. Sonnet handles most goals — bridge setup following
documented config, frontend work once a pattern is established — the same
guidance that applies generally (Sonnet for most coding, Opus/Fable-tier for
genuine architectural decisions) applies here. Haiku runs the cheap, high-volume
subagent work — summarizing docs, parsing test output, filtering logs. Since
Sonnet already does the version-to-goal decomposition, it tags each goal with a
recommended tier as part of that output, so the tier is decided once, up front,
by the model with full context of what's actually architecturally hard versus
mechanical — not chosen per goal by hand. Fable also always runs extended
thinking and can't disable it, so it's the most quota-hungry of the three by
default; reserving it for the goals that need it is what actually stretches the
window, not a uniform choice of "the best model for everything."

### Rate limits: stretch the window, then don't wait on it if avoidable

Both plans have rolling usage windows that a long unattended stretch will
actually hit even with careful tiering. That's expected, not a failure: Claude
Code sessions persist locally, and an active `/goal` condition is automatically
restored on `--resume`/`--continue`, so nothing is lost when a window is hit —
it's a pause, not a reset. The order that gets the most unattended runway out of
two separate subscriptions: try Codex rescue first, since it continues
immediately on a completely separate ChatGPT quota with no waiting at all; only
fall back to waiting out Claude's own window if Codex's is exhausted too. Claude
Code doesn't yet notice on its own that a window has reopened, so that waiting
step needs a small wrapper loop around the CLI (retry-with-backoff, or a
community tool that reads the actual reset timestamp) to auto-continue once it
does — without that, "wait for the window" silently becomes "wait for you to
notice and come back."

### Keeping context and token use down over a long stretch

- Push verbose operations — test runs, log reading, documentation fetches — into
  subagents, which explore in their own separate context and report back only a
  summary, so the noise never touches the main loop's context
- Pre-filter noisy tool output with hooks before it reaches the model (e.g. a hook
  that greps test output down to just failures)
- Keep this file and PROJECT.md lean; anything module-specific or specialized
  belongs in a skill that loads on demand, not in a file that loads every turn
- A local code-intelligence graph (candidate: CodeGraph, or code-review-graph,
  exposed to agents over MCP) lets Claude query the codebase's structure instead
  of re-reading files to rediscover it. Benefit is scale-dependent — modest on
  Starling's first module or two, more meaningful once the codebase has grown
  across several versions and the same agent keeps coming back to it

### Git, branching, and merging

- Source lives in a private GitHub repo — this is source code, not user data, and
  isn't covered by the local-only principle above
- Each module gets its own branch or worktree, isolating its edits from anything
  else in flight
- Before a module's branch merges into `main`: its `/goal` condition has to be
  demonstrably met, all unit tests have to pass, integration tests have to pass
  wherever the module has them, and it has to pass an adversarial review. All
  four, not review alone — a module without passing tests doesn't merge no matter
  how clean the review looks. Review runs locally (`/code-review` in the same
  session, or handed to Codex) rather than through a GitHub Actions-triggered bot —
  Anthropic's automatic PR-review product is Team/Enterprise only as of this
  research, and a cloud CI step would typically need separate API billing to
  authenticate, which the subscription-only approach above is deliberately
  avoiding
- Once both pass, the merge to `main` happens without a human — this repeats for
  every module in a version
- Claude Code's own checkpoint/rewind feature is a fast, session-local undo for
  Claude's own edits. It is not a substitute for git and doesn't survive across
  modules — git commits are the actual durable record

### Versions, tags, and deployment

Merging to `main` and deploying to the Mac Mini are different moments. `main`
accumulates module work continuously and autonomously. The Mac Mini only gets
updated after a version is fully assembled on `main` *and* a human has reviewed
it — at that point it gets a git tag (`v1`, `v2`, ...) and that tagged state,
specifically, is what ships to the Mac Mini. The Mac Mini always runs the last
verified tag, never the unreviewed tip of `main` — and the tag doubles as a clean
rollback point if a later version goes wrong.

### Still open

Contact lookup and the platform integration approach (see above) are both left as
implementation choices for whoever builds them — this file intentionally does not
prescribe how.

## Open items still pending

- [ ] Decide the platform integration approach (see open research question above)
- [ ] Confirm Mac Mini's actual RAM and core count
- [ ] Decide target macOS version + OpenCore Legacy Patcher plan for the Mac Mini
- [x] Name the project / repo — Starling
