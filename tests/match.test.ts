import { expect, test } from 'claude-code/testing'

import { rangeOf, rows, segments, touchesCode } from '../hooks/match'

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
  expect(parts[1]?.text).toBe('- Route 2, the band button.')
})

test('rows keep the blank lines around a mark as blank rows', async () => {
  const parts = segments(message, [{ id: 'a', text: '• Route 1, the slash command.\n• Route 2, the band button.' }])
  const drawn = rows(parts)
  expect(drawn.map(row => (row.blank ? '_' : row.id ?? '-'))).toEqual(['-', '_', 'a', '_', '-'])
})

test('a few selected words become a span row on their displayed line', async () => {
  const marks = [{ id: 'w', text: 'the band button' }]
  const drawn = rows(segments(message, marks), marks)
  const row = drawn.find(r => !r.blank && r.id === 'w')
  expect(row && !row.blank && row.span ? row.text.slice(...row.span) : null).toBe('the band button')
  expect(row && !row.blank ? row.text : null).toBe('• Route 2, the band button.')
  expect(row && !row.blank ? row.indent : null).toBe(2)
})

test('a span row on a numbered item carries its marker width', async () => {
  const numbered = ['1. The core flow. A phone enrols a key.', '2. Attestation. The hardest part.'].join('\n')
  const marks = [{ id: 'n', text: 'The core flow. A phone enrols' }]
  const row = rows(segments(numbered, marks), marks).find(r => !r.blank && r.id === 'n')
  expect(row && !row.blank && row.span ? [row.indent, row.text.slice(...row.span)] : null).toEqual([3, 'The core flow. A phone enrols'])
})

test('touchesCode tells fenced lines from prose', async () => {
  const withCode = ['Run this:', '', '```sh', 'npm test', '```', '', 'Then read the output.'].join('\n')
  expect(touchesCode(withCode, { start: 3, end: 3 })).toBe(true)
  expect(touchesCode(withCode, { start: 2, end: 4 })).toBe(true)
  expect(touchesCode(withCode, { start: 6, end: 6 })).toBe(false)
  expect(touchesCode(withCode, { start: 0, end: 0 })).toBe(false)
})
