# Highlights for Claude Code

A Claude Code mod that lets you select lines in the conversation with the mouse, save them as highlights, add notes, and jump back to them later. Like highlighting in an e-book reader, for your terminal sessions.

## Use

- Select text in the transcript (fullscreen mode, mouse drag), then press your key. A `★` button sits above the prompt and listens for the `footer:dismiss` keybinding action, so bind it, for example `"ctrl+alt+j": "footer:dismiss"` in the `Global` context of `~/.claude/keybindings.json`.
- `/hl` does the same from the prompt.
- `/highlights` toggles the pane. Click a row to jump to its message, type a note under it, or delete it.
- `/highlights clear` removes this session's highlights, `/highlights clear all` removes every session's.
- Only prose can be highlighted. Selecting code lines or tool output shows a toast instead.

Highlights persist in the mod's store under `~/.claude/plugins/store/`.

## Install

Inside Claude Code, once:

```
/plugin marketplace add that-one-arab/claude-code-highlights
/plugin install highlights@highlights
```

The mod then loads in every session. From a local clone instead, pass the clone's path to `marketplace add`.

To try it without installing:

```
claude --plugin-dir /path/to/this/repo
```

Needs Claude Code 2.1.287 or newer with fullscreen rendering on (`"tui": "fullscreen"` in settings). `RESEARCH.md` records why it is built as a mod and what the API offers.

## Develop

```
claude plugin validate .
claude plugin test .
```
