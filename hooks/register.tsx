import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Highlight } from '../types'
import { rangeOf, rows, segments, touchesCode } from './match'

const KEY = 'highlights'
const PANE = 'highlights'
const FLASH_MS = 1500

// This session's highlights, drawn by the pane and the message rows; the store holds every session's.
const list = atom({ plugin: 'highlights', key: 'list' } as const, [], { shape: 'hl-1' })
const selected = atom({ plugin: 'highlights', key: 'selected' } as const, null)
// The highlight lit up after a jump, for FLASH_MS.
const flash = atom({ plugin: 'highlights', key: 'flash' } as const, null)

const readAll = async ($: EngineInterface) => ((await $.store.get(KEY)) as Highlight[] | undefined) ?? []

const writeAll = async ($: EngineInterface, all: Highlight[]) => {
  await $.store.set(KEY, all)
  const sessionId = await $.session.id()
  await update($, list, () => all.filter(h => h.sessionId === sessionId))
}

// The markdown of every message row drawn so far, by row id: what a selection is checked against.
// ponytail: a module Map, refilled as rows re-render after a reload; a row never drawn since is unknown and allowed
const drawnText = new Map<string, string>()

// Saves what the person last selected with the mouse. Prose only: the in-place mark is the feedback;
// code and tool output are refused with a toast.
const saveSelection = async ($: EngineInterface) => {
  const picked = await $.ui.selection()
  if (!picked?.text.trim()) {
    $.ui.toast('Nothing selected. Drag over text first.')
    return
  }
  if (picked.requestId?.startsWith('toolu_')) {
    $.ui.toast('Tool output can’t be highlighted, only text.')
    return
  }
  const source = picked.requestId && drawnText.get(picked.requestId)
  const range = source ? rangeOf(source, picked.text) : null
  if (source && range && touchesCode(source, range)) {
    $.ui.toast('Code lines can’t be highlighted, only text.')
    return
  }
  const hl: Highlight = {
    id: crypto.randomUUID(),
    sessionId: await $.session.id(),
    cwd: await $.session.cwd(),
    // The newest message's row id carries a zeroed last segment: keep the stable prefix.
    messageId: picked.requestId?.replace(/-0{12}$/, '') ?? null,
    text: picked.text,
    createdAt: new Date(await $.clock.now()).toISOString(),
  }
  await writeAll($, [...(await readAll($)), hl])
  if (!hl.messageId) $.ui.toast('Saved. It spans several messages, so it has no in-place mark.')
}

// Scrolls the transcript to the highlight's message and lights it up. Only works from the person's own press.
const jumpTo = async ($: EngineInterface, hl: Highlight) => {
  if (!hl.messageId) {
    $.ui.toast('This highlight spans several messages: no anchor to jump to.')
    return
  }
  // ponytail: a prefix (newest message at save time) is tried with the zeroed suffix; a re-keyed row is missed
  const candidates = hl.messageId.length === 36 ? [hl.messageId] : [`${hl.messageId}-000000000000`]
  for (const requestId of candidates) {
    const moved = await $.ui.scroll({ to: { requestId }, block: 'center' })
    if (moved.deny) continue
    await update($, flash, () => hl.id)
    $.clock.after(FLASH_MS, () => void update($, flash, current => (current === hl.id ? null : current)))
    return
  }
  $.ui.toast('Message is not in the drawn transcript rows.')
}

// Draws a message with its highlighted lines on a coloured background; null when it has none.
const drawMarks = async ($: EngineInterface, e: RenderInput<'AssistantMessage' | 'UserMessage'>) => {
  drawnText.set(e.requestId, e.props.text)
  const mine = await read($, list)
  const here = mine.filter(hl => hl.messageId && e.requestId.startsWith(hl.messageId))
  if (here.length === 0) return null
  const parts = segments(e.props.text, here)
  if (!parts.some(part => part.id)) return null
  const lit = await read($, flash)
  const { Box, Markdown, Text } = $.ui.resolve(e)
  // The engine's row opens with a gutter: `● ` on a reply's first block, `> ` on a prompt, else two cells.
  const gutter =
    e.component === 'UserMessage' ? (
      <Text dimColor>{'> '}</Text>
    ) : e.props.isFirstOfReply ? (
      <Text color="claude">{'● '}</Text>
    ) : (
      <Text>{'  '}</Text>
    )
  // marginTop stands in for the blank row the engine draws above its own message rows.
  return (
    <Box flexDirection="row" marginTop={1}>
      {gutter}
      <Box flexDirection="column" flexGrow={1}>
        {rows(parts, here).map((row, i) =>
          row.blank ? (
            <Text> </Text>
          ) : row.span ? (
            <Text>
              {row.text.slice(0, row.span[0])}
              <Text backgroundColor={row.id === lit ? 'warning' : 'subtle'}>{row.text.slice(row.span[0], row.span[1])}</Text>
              {row.text.slice(row.span[1])}
            </Text>
          ) : row.id ? (
            <Box key={`${row.id}-${i}`} backgroundColor={row.id === lit ? 'warning' : 'subtle'}>
              <Markdown text={row.text} />
            </Box>
          ) : (
            <Markdown text={row.text} />
          ),
        )}
      </Box>
    </Box>
  )
}

const firstLine = (text: string) => text.trim().split('\n')[0] ?? ''

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hl', description: 'Save the selected transcript text as a highlight' })
    await $.command.register({
      name: 'highlights',
      description: "Toggle the highlights pane; `clear` or `clear all` removes highlights",
      argumentHint: 'clear | clear all',
    })
    const sessionId = await $.session.id()
    const mine = (await readAll($)).filter(h => h.sessionId === sessionId)
    await update($, list, () => mine)
    return next(e)
  })

  // Trigger 1: the slash command (also bound to a key as `command:hl`). Adds a hidden row to the transcript.
  on('command.run', { command: 'hl' }, async $ => {
    await saveSelection($)
    return {}
  })

  // Trigger 2: a one-glyph band button. `action` names an engine keybinding action with no handler
  // mounted at the prompt, so the person's chord for it presses this button: no command, no row.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Button } = $.ui.resolve(e)
    return <Button key="hl" plain label="★" action="footer:dismiss" onPress={() => void saveSelection($)} />
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => (await drawMarks($, e)) ?? next(e))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    // Hide the `> /hl` echo row so a highlight adds nothing to the transcript view.
    if (e.props.text.trim() === '/hl') {
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    return (await drawMarks($, e)) ?? next(e)
  })

  on('command.run', { command: 'highlights' }, async ($, e) => {
    const sessionId = await $.session.id()
    const all = await readAll($)
    const arg = e.args.trim()
    if (arg === 'clear all') {
      await writeAll($, [])
      return { text: `Cleared ${all.length} highlight(s) across all sessions.` }
    }
    if (arg === 'clear') {
      await writeAll($, all.filter(h => h.sessionId !== sessionId))
      return { text: `Cleared ${all.filter(h => h.sessionId === sessionId).length} highlight(s) from this session.` }
    }
    // `/highlights` toggles the pane.
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })
      return {}
    }
    await $.ui.open({ id: PANE, title: 'Highlights', focus: true, columns: 48 })
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const mine = await read($, list)
    const pickedId = await read($, selected)
    const picked = mine.find(item => item.id === pickedId)

    if (mine.length === 0) {
      return <Text dimColor>No highlights yet. Select text in the transcript, then press your key.</Text>
    }

    return (
      <Box flexDirection="column">
        {mine.map((item, i) => (
          <Button
            key={item.id}
            plain
            onPress={async () => {
              await update($, selected, () => item.id)
              await jumpTo($, item)
            }}
          >
            {item.id === pickedId ? '▶ ' : '  '}{i + 1}. {firstLine(item.text)}
          </Button>
        ))}
        {picked && (
          <Box marginTop={1}>
            <Button
              key="delete"
              plain
              onPress={async () => {
                await writeAll($, (await readAll($)).filter(item => item.id !== picked.id))
                await update($, selected, () => null)
              }}
            >
              Delete this highlight
            </Button>
          </Box>
        )}
      </Box>
    )
  })
}
