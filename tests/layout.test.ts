import { expect, test } from 'claude-code/testing'

import { paneLayout, wrappedRows } from '../hooks/layout'

test('wrappedRows counts rows as a greedy word wrap would', async () => {
  expect(wrappedRows('aaa bbb ccc', 7)).toBe(2)
  expect(wrappedRows('abcdefghij', 4)).toBe(3)
  expect(wrappedRows('a\nb', 10)).toBe(2)
  expect(wrappedRows('', 10)).toBe(1)
})

test('paneLayout places highlights with a blank row between and a footer after', async () => {
  expect(paneLayout(['one', 'two\nthree'], 40)).toEqual({ starts: [0, 2], total: 6 })
})
