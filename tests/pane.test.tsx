import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'highlights',
  component: 'Pane',
  requestId: 'highlights',
  props: {
    title: 'Highlights',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const one = {
  id: 'h1',
  sessionId: 's1',
  cwd: '/',
  messageId: 'm1',
  text: 'Hello world\nsecond line',
  note: '',
  createdAt: '2026-10-29T00:00:00Z',
}

test('the pane lists a stored highlight by its first line', async ($, on) => {
  on('state.get', { key: 'list' }, () => ({ value: { value: { shape: 'hl-1', value: [one] }, version: 1 } }))
  on('state.get', { key: 'selected' }, () => ({ value: { value: null, version: 0 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', key: 'h1' })
  expect(row?.text).toBe('  1. Hello world')
  await ui.unmount()
})

test('a message draws a few selected words inside a marked Text', async ($, on) => {
  const words = { ...one, id: 'w1', messageId: 'm1', text: 'second line' }
  on('state.get', { key: 'list' }, () => ({ value: { value: { shape: 'hl-1', value: [words] }, version: 1 } }))
  on('state.get', { key: 'flash' }, () => ({ value: { value: null, version: 0 } }))

  const ui = await $.ui.mount({
    plugin: 'highlights',
    component: 'AssistantMessage',
    requestId: 'm1',
    surface: 'terminal',
    props: { text: 'Hello world\nthe second line here', isFirstOfReply: true },
  })
  const marked = await ui.find({ type: 'Text', text: /^second line$/ })
  expect(marked?.text).toBe('second line')
  await ui.unmount()
})

test('an empty pane says so', async ($, on) => {
  on('state.get', () => ({ value: { value: undefined, version: 0 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No highlights yet/ }))?.text).toMatch(/No highlights yet/)
  await ui.unmount()
})
