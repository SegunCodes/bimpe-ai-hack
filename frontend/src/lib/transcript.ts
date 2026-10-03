export interface Turn {
  speaker: 'agent' | 'customer'
  text: string
}

const AGENT = /^(agent|ai|assistant|bot|bimpe|system)$/i
const CUSTOMER = /^(customer|user|caller|human|client)$/i

/** Tries to split a transcript into agent/customer turns. Returns null if it can't. */
export function parseTranscript(raw: string | null | undefined): Turn[] | null {
  if (!raw || !raw.trim()) return null

  // JSON array like [{ role: 'assistant', content: '...' }]
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      const turns: Turn[] = []
      for (const t of data) {
        const role = String(t?.role ?? t?.speaker ?? '')
        const text = String(t?.content ?? t?.message ?? t?.text ?? '').trim()
        if (!text) continue
        if (AGENT.test(role)) turns.push({ speaker: 'agent', text })
        else if (CUSTOMER.test(role)) turns.push({ speaker: 'customer', text })
      }
      if (turns.length) return turns
    }
  } catch {
    // not JSON, try line-by-line
  }

  // Lines like "Agent: Hello" / "Customer: Hi"
  const turns: Turn[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/)
    if (m && (AGENT.test(m[1]) || CUSTOMER.test(m[1]))) {
      turns.push({ speaker: AGENT.test(m[1]) ? 'agent' : 'customer', text: m[2] })
    } else if (line.trim() && turns.length) {
      turns[turns.length - 1].text += ' ' + line.trim()
    }
  }
  return turns.length >= 1 ? turns : null
}
