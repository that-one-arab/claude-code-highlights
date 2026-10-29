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

test('an empty pane says so', async ($, on) => {
  on('state.get', () => ({ value: { value: undefined, version: 0 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No highlights yet/ }))?.text).toMatch(/No highlights yet/)
  await ui.unmount()
})
