import { parseTranscript } from '../lib/transcript'

export function Transcript({ text }: { text: string | null }) {
  if (!text || !text.trim()) {
    return <p className="text-sm italic text-slate-400">No transcript yet.</p>
  }
  const turns = parseTranscript(text)
  if (!turns) {
    return <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-base leading-relaxed text-slate-700">{text}</p>
  }
  return (
    <div className="flex flex-col gap-2.5">
      {turns.map((t, i) => (
        <div key={i} className={`flex flex-col ${t.speaker === 'agent' ? 'items-start' : 'items-end'}`}>
          <span className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.speaker === 'agent' ? 'AI agent' : 'Customer'}
          </span>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
              t.speaker === 'agent' ? 'rounded-tl-md bg-slate-100 text-slate-800' : 'rounded-tr-md bg-accent-600 text-white'
            }`}
          >
            {t.text}
          </div>
        </div>
      ))}
    </div>
  )
}
