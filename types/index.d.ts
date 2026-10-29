export type Highlight = {
  id: string
  sessionId: string
  cwd: string
  messageId: string | null
  text: string
  note: string
  createdAt: string
}

declare module 'claude-code' {
  interface PluginState {
    highlights: { list: Shaped<Highlight[]>; selected: string | null }
  }
}
