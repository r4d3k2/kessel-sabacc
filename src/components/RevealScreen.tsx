import { Trophy, Loader2, Dices } from 'lucide-react'
import { PlayingCard } from './PlayingCard'
import { ChipCount } from './TableInfo'
import { willEndGame, handScore, compareHandScore, type GameState, type RoundResult } from '../lib/sabacc'

interface Props {
  state: GameState
  /** Partii dohrávají jen AI — reveal se proklikne sám. */
  autoAdvancing?: boolean
  onNext: () => void
}

export function RevealScreen({ state, autoAdvancing = false, onNext }: Props) {
  const winnerId = state.roundWinnerId
  const winner = state.players.find((p) => p.id === winnerId) ?? null
  const results = state.roundResults ?? []
  const byId = new Map<number, RoundResult>(results.map((r) => [r.playerId, r]))

  // Účastníci kola seřazení podle síly ruky (nejsilnější nahoře).
  const participants = state.players
    .filter((p) => byId.has(p.id))
    .sort((a, b) => compareHandScore(handScore(byId.get(a.id)!.resolved), handScore(byId.get(b.id)!.resolved)))
  // Hráči vyřazení už v dřívějších kolech.
  const goneEarlier = state.players.filter((p) => !byId.has(p.id))

  const last = willEndGame(state)

  return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-md mx-auto">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Konec kola {state.round}</p>
        {winner ? (
          <p className="mt-2 text-2xl font-black text-emerald-400 flex items-center justify-center gap-2">
            <Trophy size={24} /> {winner.name} bere kolo!
          </p>
        ) : (
          <p className="mt-2 text-2xl font-black text-slate-300">Remíza — nikdo nebere kolo</p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {participants.map((p) => {
          const r = byId.get(p.id)!
          return (
            <div
              key={p.id}
              className={`rounded-2xl p-3 flex items-center justify-between ${
                r.isWinner ? 'bg-emerald-950/60 ring-2 ring-emerald-400' : r.eliminated ? 'bg-red-950/40' : 'bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <PlayingCard family="sand" value={p.hand.sand.value} kind={p.hand.sand.kind} size="sm" highlight={r.isWinner} />
                <PlayingCard family="blood" value={p.hand.blood.value} kind={p.hand.blood.kind} size="sm" highlight={r.isWinner} />
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-100">{p.name}</p>

                {/* Detaily vyřešení speciálních karet */}
                {r.resolved.imposterRolls.map((ir) => (
                  <p key={ir.family} className="text-xs text-slate-400 flex items-center justify-end gap-1">
                    <Dices size={12} /> Imposter ({ir.family === 'sand' ? 'Sand' : 'Blood'}) → {ir.roll}
                  </p>
                ))}
                {r.resolved.sylopMatched && (
                  <p className="text-xs text-slate-400">
                    Sylop ({r.resolved.sylopMatched.family === 'sand' ? 'Sand' : 'Blood'}) → {r.resolved.sylopMatched.value}
                  </p>
                )}

                {r.resolved.isPureSabacc ? (
                  <p className="text-sm font-bold text-emerald-400">Pure Sabacc!</p>
                ) : r.handValue === 0 ? (
                  <p className="text-sm font-bold text-emerald-400">
                    Sabacc {r.resolved.sand}/{r.resolved.blood}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    rozdíl: <span className="text-amber-300">{r.handValue}</span>
                  </p>
                )}
                <p className="text-xs">
                  {r.delta > 0 ? (
                    <span className="text-emerald-400">+{r.delta} (vklad zpět)</span>
                  ) : r.delta < 0 ? (
                    <span className="text-red-400">{r.delta} (penále)</span>
                  ) : (
                    <span className="text-slate-500">beze změny</span>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                  <ChipCount chips={r.chipsAfter} />
                  {r.eliminated && <span className="text-red-400">· Vyřazen</span>}
                </p>
              </div>
            </div>
          )
        })}

        {goneEarlier.map((p) => (
          <div key={p.id} className="rounded-2xl p-3 bg-slate-900/30 opacity-50 flex items-center justify-between">
            <span className="text-slate-400">{p.name}</span>
            <span className="text-xs text-red-400">Vyřazen — kolo {p.eliminatedRound}</span>
          </div>
        ))}
      </div>

      {autoAdvancing ? (
        <p className="w-full h-14 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 size={16} className="animate-spin" /> Dohrává se mezi soupeři…
        </p>
      ) : (
        <button
          onClick={onNext}
          className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-lg"
        >
          {last ? 'Konec hry' : 'Další kolo'}
        </button>
      )}
    </div>
  )
}
