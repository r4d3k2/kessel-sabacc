import { Loader2 } from 'lucide-react'
import { CardBack } from './PlayingCard'
import { OpponentsBar, PotDisplay, ChipCount, ActionLog } from './TableInfo'
import { TURNS_PER_ROUND, type GameState } from '../lib/sabacc'

interface Props {
  state: GameState
  /** Partii dohrávají jen AI (člověk vypadl). */
  autoPlaying?: boolean
}

/** Obrazovka, když je na tahu AI — bez předávání, jen log a krátká prodleva. */
export function AiTurnScreen({ state, autoPlaying = false }: Props) {
  const ai = state.players[state.currentPlayerIndex]

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-md mx-auto min-h-screen">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-slate-300">Na tahu soupeř</span>
        <span className="text-slate-400">
          Kolo {state.round} · Tah {state.turn}/{TURNS_PER_ROUND}
        </span>
      </div>

      {autoPlaying && (
        <p className="text-center text-xs text-slate-500">Dohrává se mezi soupeři…</p>
      )}

      <OpponentsBar players={state.players} currentId={ai.id} />
      <div className="flex justify-center">
        <PotDisplay pot={state.pot} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-3xl font-black text-amber-300">{ai.name}</p>
          <p className="mt-2 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> přemýšlí…
          </p>
          <p className="mt-1 text-sm">
            <ChipCount chips={ai.chips} />
          </p>
        </div>
        <div className="flex gap-4">
          <CardBack size="lg" family="sand" />
          <CardBack size="lg" family="blood" />
        </div>
      </div>

      <ActionLog log={state.log} />
    </div>
  )
}
