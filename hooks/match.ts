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
  if (wanted.length === 0) return null
  const start = lines.findIndex(line => matches(line, wanted[0]))
  if (start < 0) return null
  if (wanted.length === 1) return { start, end: start }
  const last = wanted[wanted.length - 1]
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

export type Row = { blank: true } | { blank?: undefined; id?: string; text: string }

// Turns segments into drawable rows: blank lines at a segment's edges become blank rows, so the
// paragraph gaps a Markdown element would trim at its ends survive; interior blank lines stay markdown.
export const rows = (parts: readonly Segment[]): Row[] => {
  const out: Row[] = []
  for (const part of parts) {
    const lines = part.text.split('\n')
    let head = 0
    while (head < lines.length && lines[head].trim() === '') head++
    let tail = lines.length
    while (tail > head && lines[tail - 1].trim() === '') tail--
    for (let i = 0; i < head; i++) out.push({ blank: true })
    if (tail > head) out.push(part.id ? { id: part.id, text: lines.slice(head, tail).join('\n') } : { text: lines.slice(head, tail).join('\n') })
    for (let i = tail; i < lines.length; i++) out.push({ blank: true })
  }
  return out
}
