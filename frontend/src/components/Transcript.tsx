import { parseTranscript } from '../lib/transcript'

export function Transcript({ text }: { text: string | null }) {
  if (!text || !text.trim()) {
    return <p className="text-sm italic text-ink-faint">No transcript yet.</p>
  }
  const turns = parseTranscript(text)
  if (!turns) {
    return <p className="whitespace-pre-wrap rounded-2xl bg-paper p-4 text-base leading-relaxed text-ink-soft">{text}</p>
  }
  return (
    <div className="flex flex-col gap-2.5">
      {turns.map((t, i) => (
        <div key={i} className={`flex flex-col ${t.speaker === 'agent' ? 'items-start' : 'items-end'}`}>
          <span className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {t.speaker === 'agent' ? 'Tellero AI' : 'Customer'}
          </span>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
              t.speaker === 'agent' ? 'rounded-tl-md bg-mist text-ink' : 'rounded-tr-md bg-danfo font-medium text-ink'
            }`}
          >
            {t.text}
          </div>
        </div>
      ))}
    </div>
  )
}
