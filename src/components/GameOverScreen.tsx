import { Trophy } from 'lucide-react'
import { ChipCount } from './TableInfo'
import type { GameState } from '../lib/sabacc'

interface Props {
  state: GameState
  onNewGame: () => void
}

export function GameOverScreen({ state, onNewGame }: Props) {
  const winnerId = state.gameWinnerId
  const winner = state.players.find((p) => p.id === winnerId) ?? null

  // Pořadí: přeživší nahoře (víc čipů lépe), pak vyřazení podle kola vypadnutí.
  const ranked = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1
    if (!a.eliminated) return b.chips - a.chips
    return (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0)
  })

  return (
    <div className="flex flex-col gap-6 px-5 py-10 max-w-md mx-auto">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Konec partie</p>
        {winner ? (
          <p className="mt-2 text-3xl font-black text-amber-300 flex items-center justify-center gap-2">
            <Trophy size={28} /> {winner.name} vyhrává!
          </p>
        ) : (
          <p className="mt-2 text-3xl font-black text-slate-300">Remíza</p>
        )}
      </header>

      <div className="rounded-2xl bg-slate-900/60 overflow-hidden">
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-3 ${
              i > 0 ? 'border-t border-slate-800' : ''
            } ${p.id === winnerId ? 'bg-amber-950/40' : ''}`}
          >
            <span className="flex items-center gap-3">
              <span className="text-slate-500 font-mono w-5">{i + 1}.</span>
              <span className="font-medium text-slate-100">{p.name}</span>
            </span>
            {p.eliminated ? (
              <span className="text-xs text-red-400">vypadl v kole {p.eliminatedRound}</span>
            ) : (
              <ChipCount chips={p.chips} />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onNewGame}
        className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-lg"
      >
        Nová hra
      </button>
    </div>
  )
}
