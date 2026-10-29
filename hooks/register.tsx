import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Highlight } from '../types'

const KEY = 'highlights'
const PANE = 'highlights'

// This session's highlights, drawn by the pane; the store holds every session's.
const list = atom({ plugin: 'highlights', key: 'list' } as const, [], { shape: 'hl-1' })
const selected = atom({ plugin: 'highlights', key: 'selected' } as const, null)

const readAll = async ($: EngineInterface) => ((await $.store.get(KEY)) as Highlight[] | undefined) ?? []

const writeAll = async ($: EngineInterface, all: Highlight[]) => {
  await $.store.set(KEY, all)
  const sessionId = await $.session.id()
  await update($, list, () => all.filter(h => h.sessionId === sessionId))
}

// Saves what the person last selected with the mouse; the toast is the only feedback.
const saveSelection = async ($: EngineInterface) => {
  const picked = await $.ui.selection()
  if (!picked?.text.trim()) {
    $.ui.toast('Nothing selected. Drag over text first.')
    return
  }
  const hl: Highlight = {
    id: crypto.randomUUID(),
    sessionId: await $.session.id(),
    cwd: await $.session.cwd(),
    // The newest message's row id carries a zeroed last segment: keep the stable prefix.
    messageId: picked.requestId?.replace(/-0{12}$/, '') ?? null,
    text: picked.text,
    note: '',
    createdAt: new Date(await $.clock.now()).toISOString(),
  }
  await writeAll($, [...(await readAll($)), hl])
  $.ui.toast(`Highlighted ${hl.text.split('\n').length} line(s)`)
}

// Scrolls the transcript to the highlight's message. Only works from the person's own press.
const jumpTo = async ($: EngineInterface, hl: Highlight) => {
  if (!hl.messageId) {
    $.ui.toast('This highlight spans several messages: no anchor to jump to.')
    return
  }
  // ponytail: a prefix (newest message at save time) is tried with the zeroed suffix; a re-keyed row is missed
  const candidates = hl.messageId.length === 36 ? [hl.messageId] : [`${hl.messageId}-000000000000`]
  for (const requestId of candidates) {
    const moved = await $.ui.scroll({ to: { requestId }, block: 'center' })
    if (!moved.deny) return
  }
  $.ui.toast('Message is not in the drawn transcript rows.')
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

  // Hide the `> /hl` echo row so a highlight adds nothing to the transcript view.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.props.text.trim() !== '/hl') return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // Trigger 2: a one-glyph band button. `action` names an engine keybinding action with no handler
  // mounted at the prompt, so the person's chord for it presses this button: no command, no row.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Button } = $.ui.resolve(e)
    return <Button key="hl" plain label="★" action="footer:dismiss" onPress={() => void saveSelection($)} />
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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface === 'mobile') return next(e) // no Input element there
    const { Box, Text, Button, Input } = $.ui.resolve(e)
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
          <Box flexDirection="column" marginTop={1} borderStyle="single" borderDimColor paddingX={1}>
            <Text>{picked.text}</Text>
            <Input
              key="note"
              label="Note: "
              placeholder="type a note, Enter saves"
              value={picked.note}
              onSubmit={async note => {
                await writeAll($, (await readAll($)).map(item => (item.id === picked.id ? { ...item, note } : item)))
                $.ui.toast('Note saved')
              }}
            />
            {picked.note && <Text dimColor>{picked.note}</Text>}
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
