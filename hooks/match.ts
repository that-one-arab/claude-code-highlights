// Maps a selection (rendered text) back onto the lines of a message (markdown source).

// Strip list markers, quotes, headings, emphasis and spacing so rendered and source lines compare.
export const normalize = (line: string) =>
  line
    .replace(/^[\s>]*(?:[-*•]|\d+[.)])?\s*/, '')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const matches = (line: string, wanted: string) =>
  line.length > 0 && (line.includes(wanted) || (line.length > 3 && wanted.includes(line)))

// The inclusive line range of `selected` inside `message`, or null when its first line is not found.
export const rangeOf = (message: string, selected: string) => {
  const lines = message.split('\n').map(normalize)
  const wanted = selected.split('\n').map(normalize).filter(Boolean)
  const first = wanted[0]
  if (!first) return null
  const start = lines.findIndex(line => matches(line, first))
  if (start < 0) return null
  if (wanted.length === 1) return { start, end: start }
  const last = wanted[wanted.length - 1] ?? first
  const end = lines.findIndex((line, i) => i > start && matches(line, last))
  return { start, end: end < 0 ? start : end }
}

export type Segment = { id?: string; text: string }

// Splits `message` into runs of lines, each run owned by the first mark that covers it, or by none.
// ponytail: a mark inside a code fence splits the fence; good enough until someone highlights code
export const segments = (message: string, marks: readonly { id: string; text: string }[]): Segment[] => {
  const lines = message.split('\n')
  const owner: (string | undefined)[] = new Array(lines.length)
  for (const mark of marks) {
    const range = rangeOf(message, mark.text)
    if (!range) continue
    for (let i = range.start; i <= range.end; i++) owner[i] ??= mark.id
  }
  const out: Segment[] = []
  lines.forEach((line, i) => {
    const last = out[out.length - 1]
    if (last && last.id === owner[i]) last.text += `\n${line}`
    else out.push(owner[i] ? { id: owner[i], text: line } : { text: line })
  })
  return out
}

export type Row =
  | { blank: true }
  // A markdown run, marked when `id` is set.
  | { blank?: undefined; id?: string; text: string; span?: undefined }
  // One line drawn as plain text with only `text.slice(...span)` marked: a selection of some words.
  | { blank?: undefined; id: string; text: string; span: [number, number] }

// A source line as the terminal shows it, near enough: bullets, emphasis and code marks removed.
export const display = (line: string) =>
  line
    .replace(/^(\s*)[-*]\s+/, '$1• ')
    .replace(/\*\*|`/g, '')

// One pane row for a highlight: `prefix`, then its first line cut to fit `width` cells, and a
// `more` suffix (drawn dim) counting the lines the row leaves out.
// ponytail: counts string length as cells; wide glyphs (emoji, CJK) overrun by a cell each
export const listRow = (text: string, prefix: string, width: number) => {
  const lines = text.trim().split('\n')
  const hidden = lines.length - 1
  const more = hidden > 0 ? ` +${hidden} ${hidden === 1 ? 'line' : 'lines'}` : ''
  const room = Math.max(8, width - prefix.length - more.length)
  const first = lines[0] ?? ''
  const head = first.length > room ? `${first.slice(0, room - 1)}…` : first
  return { head: prefix + head, more }
}

// Turns segments into drawable rows: blank lines at a segment's edges become blank rows, so the
// paragraph gaps a Markdown element would trim at its ends survive; interior blank lines stay markdown.
// A one-line mark that covers part of its line becomes a span row.
export const rows = (parts: readonly Segment[], marks: readonly { id: string; text: string }[] = []): Row[] => {
  const out: Row[] = []
  for (const part of parts) {
    const lines = part.text.split('\n')
    let head = 0
    while (head < lines.length && lines[head]?.trim() === '') head++
    let tail = lines.length
    while (tail > head && lines[tail - 1]?.trim() === '') tail--
    for (let i = 0; i < head; i++) out.push({ blank: true })
    if (tail > head) {
      const text = lines.slice(head, tail).join('\n')
      const mark = part.id ? marks.find(m => m.id === part.id) : undefined
      // One line in the run: `text` is that line.
      const span = mark && tail - head === 1 ? spanOf(text, mark.text) : null
      if (part.id && span) out.push({ id: part.id, text: display(text), span })
      else out.push(part.id ? { id: part.id, text } : { text })
    }
    for (let i = tail; i < lines.length; i++) out.push({ blank: true })
  }
  return out
}

// Where a one-line selection sits inside the displayed line; null when it is the whole line or not found.
const spanOf = (line: string, selectedText: string): [number, number] | null => {
  const [wanted, ...more] = selectedText.split('\n').map(normalize).filter(Boolean)
  if (!wanted || more.length > 0) return null
  const at = display(line).toLowerCase().indexOf(wanted)
  if (at < 0 || wanted.length >= normalize(line).length) return null
  return [at, at + wanted.length]
}

// True when any line of `range` sits inside a fenced code block of `message`.
export const touchesCode = (message: string, range: { start: number; end: number }) => {
  let inFence = false
  const lines = message.split('\n')
  for (let i = 0; i <= range.end && i < lines.length; i++) {
    const isFence = /^\s*(```|~~~)/.test(lines[i] ?? '')
    if (isFence) inFence = !inFence
    if (i >= range.start && (inFence || isFence)) return true
  }
  return false
}
