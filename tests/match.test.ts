import { expect, test } from 'claude-code/testing'

import { rangeOf, rows, segments } from '../hooks/match'

const message = [
  '**Changed:** `/hl` now returns no output row.',
  '',
  '- Route 1, the slash command.',
  '- Route 2, the band button.',
  '',
  'Next: tell me which key works.',
].join('\n')

test('a rendered selection maps back to markdown lines', async () => {
  // Rendered text has no markdown marks and draws bullets as •.
  expect(rangeOf(message, '• Route 1, the slash command.\n• Route 2, the band button.')).toEqual({ start: 2, end: 3 })
  expect(rangeOf(message, 'Changed: /hl now returns')).toEqual({ start: 0, end: 0 })
  expect(rangeOf(message, 'not in this message')).toBe(null)
})

test('segments group lines by the mark that covers them', async () => {
  const parts = segments(message, [{ id: 'a', text: '• Route 2, the band button.' }])
  expect(parts.map(p => p.id ?? '-')).toEqual(['-', 'a', '-'])
  expect(parts[1].text).toBe('- Route 2, the band button.')
})

test('rows keep the blank lines around a mark as blank rows', async () => {
  const parts = segments(message, [{ id: 'a', text: '• Route 1, the slash command.\n• Route 2, the band button.' }])
  const drawn = rows(parts)
  expect(drawn.map(row => (row.blank ? '_' : row.id ?? '-'))).toEqual(['-', '_', 'a', '_', '-'])
})
