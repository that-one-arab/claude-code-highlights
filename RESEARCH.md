# Highlights for Claude Code: research

Verified against Claude Code 2.1.312 on 2026-10-29. Sources: the mod API
declaration file shipped with the `plugin-authoring` skill
(`claude-code.d.ts`), and the docs at code.claude.com (links at the end).

## Verdict

Build it as a **mod**: a plugin whose TypeScript hooks run inside Claude
Code's process. No fork, no terminal wrapper, no scrollback scraping. Every
primitive the feature needs already exists in the mod API:

| Need | Primitive | Status |
| --- | --- | --- |
| Read what the user selected | `$.ui.selection()` returns `{ text, requestId? }`: the selected text and the transcript row it sits in | Confirmed in types |
| Trigger it with a key | `$.command.register({ name: 'hl' })` plus a keybinding `"ctrl+x h": "command:hl"` in the `Chat` context | Confirmed in types and keybindings doc |
| Persist across sessions | `$.store` (per-plugin JSON file under `~/.claude`, 4 MiB cap) | Confirmed in types |
| Draw the highlight in place | `ui.render` hook on `AssistantMessage` / `UserMessage`: rewrite the drawn `text` or return your own tree. Draw-only, never touches the model's context or the transcript file | Confirmed in types |
| List highlights, jump back | `$.ui.open({ id, title })` pane (docks as a sidebar in fullscreen from 110 columns), `Button` per row, `$.ui.scroll({ to: { requestId }, block: 'center' })` | Confirmed in types |
| Stable anchor per message | `ui.render`'s `requestId` is "the message id"; the transcript file stores every message with a `uuid` that `--resume` keeps (same file, appended) | Likely the same id. Verify in the spike |

## Preconditions

- Fullscreen rendering must be on. It is (`"tui": "fullscreen"` in
  `~/.claude/settings.json`). `$.ui.selection()` returns `undefined` on the
  main screen, under `claude -p`, and in the SDK.
- Mouse capture must stay on (default in fullscreen). Click-drag selects,
  double-click selects a word, triple-click a line. Shift+arrows extend.
- Terminal mods need Claude Code 2.1.287 or newer. Installed: 2.1.312.

## How the selection reaches the mod

1. User drags over lines in the transcript. Fullscreen copies on release.
2. User presses the bound chord, or types `/hl`. Any key normally clears the
   highlight on screen, but `$.ui.selection()` still answers "what the person
   last selected" until they select again or their next prompt or command
   has run. A `command.run` hook is inside that window.
3. The hook gets `{ text, requestId }`. `requestId` is absent when the
   selection spans several rows (multiple messages), lies outside the
   transcript, or has scrolled out of the drawn rows. Store the text anyway
   and fall back to "no anchor".

## Data model

One record per highlight in `$.store` under key `highlights`:

```json
{
  "id": "uuid",
  "sessionId": "ca5a4f13-...",
  "cwd": "/Users/mo/projects/...",
  "messageId": "requestId or null",
  "role": "assistant | user | tool | unknown",
  "text": "the selected lines, verbatim",
  "note": "",
  "createdAt": "2026-10-29T12:00:00Z"
}
```

`sessionId` comes from `$.session.id()` (the transcript file's name), so
`claude --resume <sessionId>` reopens the conversation. Keep the text copy:
messages are immutable, so a text match inside the message is a good enough
line anchor for re-rendering, and the copy survives compaction.

## Rendering the mark

`on('ui.render', { component: 'AssistantMessage' }, ...)` fires per text
block with `e.requestId` and `e.props.text` (markdown). For a block that has
highlights, either:

- rewrite `text` and pass `next({ ...e, props })`: cheapest, keeps the
  engine's markdown drawing, mark lines with a prefix glyph; or
- return your own tree: `Box` with `backgroundColor` around the matched
  lines, full control, more code.

Start with the rewrite. The same hook on `UserMessage` covers the user's
own prompts. Tool output rows are `ToolUse` / `ToolResult` sites; skip them
in v1.

## Reviewing highlights

- **In-session pane**: `/highlights` opens a docked pane. Rows are
  `Button`s: press scrolls the transcript to the message (scroll into a
  transcript row works only while answering the person's own input, which a
  press is). An `Input` under the selected row edits the note.
- **Across sessions**: the same pane with a "all sessions" toggle, grouped
  by `cwd` then session, newest first. Add a `/highlights export` that writes
  markdown to `$.fs` in the project (`HIGHLIGHTS.md`) for people who want it
  in git or Obsidian.

## Alternatives rejected

| Option | Why not |
| --- | --- |
| Patch or fork the Claude Code TUI | Closed, minified bundle. Breaks every release. |
| tmux / terminal wrapper reading scrollback | No message ids, no in-app rendering, line offsets drift with resize. |
| settings.json command hooks (`Stop`, `MessageDisplay`) | Receive text, not the selection, and cannot draw UI. |
| Standalone JSONL reader TUI | Works for cross-session review but can't capture a highlight at the moment of reading. Keep as a fallback if the mods API breaks. |

## Risks

- The mods API is labelled early access and "moves between releases". Pin
  the Claude Code version in the README and run `claude plugin validate`
  after each upgrade.
- `requestId` for a message is documented only as "the message id". If it
  is not the JSONL `uuid`, anchor by `sessionId` + text match instead.
- Selection spanning two messages gives no `requestId`. Store without an
  anchor, show it in the pane, skip in-place rendering.
- tmux users need `allow-passthrough` for mouse and clipboard.

## Plan

| Step | What | Estimate |
| --- | --- | --- |
| 1 | Spike: `/hl` reads `$.ui.selection()`, toasts the text, logs `requestId` next to the JSONL `uuid` | 1 hour |
| 2 | `$.store` persistence + `/highlights` pane with jump-to-message | 2 hours |
| 3 | In-place marks via `ui.render` rewrite | 2 hours |
| 4 | Notes input + all-sessions view + markdown export | 2 hours |
| 5 | Keybinding, README, `claude plugin test` | 1 hour |

Total: about one working day.

## Sources

- Mods overview: https://code.claude.com/docs/en/plugins/mods/overview.md
- Mod interface (panes, bands, keys): https://code.claude.com/docs/en/plugins/mods/interface.md
- Mod API (`$`): https://code.claude.com/docs/en/plugins/mods/api.md
- Mod events: https://code.claude.com/docs/en/plugins/mods/events.md
- Keybindings (`command:<name>`, `Scroll` context, `selection:*`): https://code.claude.com/docs/en/keybindings.md
- Fullscreen rendering and mouse selection: https://code.claude.com/docs/en/fullscreen.md
- Sessions and transcript location: https://code.claude.com/docs/en/sessions.md
- Hooks (what they can and cannot do): https://code.claude.com/docs/en/hooks.md
- Local API declaration used for verification: the `types/claude-code.d.ts`
  that the `plugin-authoring` skill writes (search `UiSelection`,
  `AssistantMessage`, `store:`, `scroll:`).
