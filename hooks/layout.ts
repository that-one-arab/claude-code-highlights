// Rough pane geometry: the rows the surface gives each highlight, so the hook can tell what lies
// outside the scroll window. The render props carry the window, not the tree's own height.

// Rows `text` takes at `width` cells, wrapped greedily at spaces as the terminal wraps it.
// ponytail: string length as cells (wide glyphs overrun); may differ from the surface by a row
export const wrappedRows = (text: string, width: number) => {
  let rows = 0
  for (const line of text.split('\n')) {
    rows++
    let col = 0
    for (const word of line.split(' ')) {
      const need = col === 0 ? word.length : col + 1 + word.length
      if (need <= width) {
        col = need
        continue
      }
      if (col > 0) rows++
      rows += Math.floor(Math.max(word.length - 1, 0) / width)
      col = word.length % width || Math.min(word.length, width)
    }
  }
  return rows
}

// Where each highlight starts in the pane's tree and how tall the tree is: a number column as
// wide as `'  1. '`, a blank row between highlights, then a blank row and the one-row footer.
export const paneLayout = (texts: readonly string[], bodyColumns: number) => {
  const starts: number[] = []
  let row = 0
  texts.forEach((text, i) => {
    starts.push(row)
    row += wrappedRows(text.trim(), Math.max(1, bodyColumns - `  ${i + 1}. `.length)) + 1
  })
  return { starts, total: row + 1 }
}
