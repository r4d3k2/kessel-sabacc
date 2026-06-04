import { Coins } from 'lucide-react'
import type { Player } from '../lib/sabacc'

/** Malý štítek s počtem čipů. */
export function ChipCount({ chips, className = '' }: { chips: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-amber-300 font-semibold ${className}`}>
      <Coins size={14} />
      {chips}
    </span>
  )
}

/** Pot uprostřed stolu. */
export function PotDisplay({ pot }: { pot: number }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-slate-900/70 px-4 py-1.5 text-sm">
      <span className="text-slate-400">Pot</span>
      <ChipCount chips={pot} className="text-base" />
    </div>
  )
}

/** Dlaždice ostatních hráčů (karty skryté), s čipy a stavem. */
export function OpponentsBar({
  players,
  currentId,
}: {
  players: Player[]
  currentId: number
}) {
  const others = players.filter((p) => p.id !== currentId)
  return (
    <div className="flex flex-wrap gap-2">
      {others.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
            p.eliminated ? 'bg-slate-900/40 opacity-50' : 'bg-slate-800'
          }`}
        >
          <span className="text-slate-200 font-medium">{p.name}</span>
          <ChipCount chips={p.chips} />
          <span
            className={
              p.eliminated ? 'text-red-400' : p.standing ? 'text-emerald-400' : 'text-slate-500'
            }
          >
            {p.eliminated ? 'venku' : p.standing ? 'stojí' : 'hraje'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Log akcí AI. */
export function ActionLog({ log }: { log: string[] }) {
  if (log.length === 0) return null
  return (
    <div className="rounded-lg bg-slate-900/50 px-3 py-2 text-xs text-slate-400 space-y-0.5">
      {log.slice(-4).map((line, i) => (
        <p key={i} className={i === Math.min(log.length, 4) - 1 ? 'text-slate-200' : ''}>
          {line}
        </p>
      ))}
    </div>
  )
}
