import { useState, type ReactNode } from 'react'
import { Hand as HandIcon, Check, Coins } from 'lucide-react'
import { PlayingCard, CardBack } from './PlayingCard'
import { OpponentsBar, PotDisplay, ChipCount, ActionLog } from './TableInfo'
import {
  canDrawFrom,
  canAffordDraw,
  previewHandValue,
  TURNS_PER_ROUND,
  DRAW_COST,
  type Card,
  type DrawSource,
  type GameState,
} from '../lib/sabacc'

/** Lidsky čitelný název karty (vč. speciálních). */
function cardLabel(card: Card): string {
  const fam = card.family === 'sand' ? 'Sand' : 'Blood'
  if (card.kind === 'sylop') return `${fam} Sylop`
  if (card.kind === 'imposter') return `${fam} Imposter`
  return `${fam} ${card.value}`
}

interface Props {
  state: GameState
  onDrawFromSource: (source: DrawSource) => void
  onResolveDraw: (keepDrawn: boolean) => void
  onStand: () => void
}

export function TurnScreen({ state, onDrawFromSource, onResolveDraw, onStand }: Props) {
  const [choosingSource, setChoosingSource] = useState(false)
  const player = state.players[state.currentPlayerIndex]
  const preview = previewHandValue(player.hand)
  const pending = state.pendingDraw
  const affordable = canAffordDraw(state)

  const pickSource = (source: DrawSource) => {
    if (!canDrawFrom(state, source)) return
    onDrawFromSource(source)
    setChoosingSource(false)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-md mx-auto min-h-screen">
      {/* Hlavička */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-amber-300 flex items-center gap-2">
          {player.name} <ChipCount chips={player.chips} />
        </span>
        <span className="text-slate-400">
          Kolo {state.round} · Tah {state.turn}/{TURNS_PER_ROUND}
        </span>
      </div>

      <OpponentsBar players={state.players} currentId={player.id} />
      <div className="flex justify-center">
        <PotDisplay pot={state.pot} />
      </div>
      <ActionLog log={state.log} />

      {/* Zdroje tažení */}
      <div className="rounded-2xl bg-slate-900/60 p-3">
        <p className="text-xs text-slate-400 mb-2">
          {choosingSource ? 'Vyber zdroj, ze kterého táhneš:' : 'Balíčky a odhazovací hromádky'}
        </p>
        <div className="grid grid-cols-4 gap-2 justify-items-center">
          <SourceSlot label="Odhoz S" active={choosingSource} disabled={!canDrawFrom(state, 'sandDiscard')} onClick={() => pickSource('sandDiscard')}>
            {state.discards.sand.length > 0 ? (
              <PlayingCard family="sand" value={state.discards.sand.at(-1)!.value} kind={state.discards.sand.at(-1)!.kind} size="sm" />
            ) : (
              <CardBack size="sm" empty />
            )}
          </SourceSlot>
          <SourceSlot label="Braní S" active={choosingSource} disabled={!canDrawFrom(state, 'sandDeck')} onClick={() => pickSource('sandDeck')}>
            <CardBack size="sm" family="sand" empty={state.decks.sand.length === 0} />
          </SourceSlot>
          <SourceSlot label="Braní B" active={choosingSource} disabled={!canDrawFrom(state, 'bloodDeck')} onClick={() => pickSource('bloodDeck')}>
            <CardBack size="sm" family="blood" empty={state.decks.blood.length === 0} />
          </SourceSlot>
          <SourceSlot label="Odhoz B" active={choosingSource} disabled={!canDrawFrom(state, 'bloodDiscard')} onClick={() => pickSource('bloodDiscard')}>
            {state.discards.blood.length > 0 ? (
              <PlayingCard family="blood" value={state.discards.blood.at(-1)!.value} kind={state.discards.blood.at(-1)!.kind} size="sm" />
            ) : (
              <CardBack size="sm" empty />
            )}
          </SourceSlot>
        </div>
        {choosingSource && (
          <button
            onClick={() => setChoosingSource(false)}
            className="mt-3 w-full h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium"
          >
            Zrušit
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Ruka hráče */}
      <div className="rounded-2xl bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400">Tvoje ruka</span>
          <span className="text-sm font-bold text-slate-200">
            {preview.hasImposter ? (
              <span className="text-slate-300">Rozdíl: <span className="text-[#2fd4c4]">?</span></span>
            ) : (
              <>
                Rozdíl:{' '}
                <span className={preview.isSabacc ? 'text-emerald-400' : 'text-amber-300'}>{preview.value}</span>
              </>
            )}
            {preview.isPureSabacc ? (
              <span className="ml-1 text-emerald-400">Pure Sabacc!</span>
            ) : preview.isSabacc ? (
              <span className="ml-1 text-emerald-400">Sabacc!</span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-center gap-4">
          <PlayingCard family="sand" value={player.hand.sand.value} kind={player.hand.sand.kind} size="lg" />
          <PlayingCard family="blood" value={player.hand.blood.value} kind={player.hand.blood.kind} size="lg" />
        </div>
        {preview.hasImposter && (
          <p className="mt-2 text-xs text-slate-500 text-center">
            Máš Imposter — jeho hodnota padne kostkou až při odhalení.
          </p>
        )}
      </div>

      {/* Akce */}
      {!pending && !choosingSource && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setChoosingSource(true)}
              disabled={!affordable}
              className="h-14 rounded-xl bg-[#13a394] hover:bg-[#0f8c7f] active:bg-[#0c7568] text-[#eafffb] font-bold text-lg flex flex-col items-center justify-center leading-tight disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Táhnout
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Coins size={11} /> {DRAW_COST} čip
              </span>
            </button>
            <button
              onClick={onStand}
              className="h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-lg"
            >
              Stát
              <span className="block text-[11px] font-medium opacity-70">zdarma</span>
            </button>
          </div>
          {!affordable && (
            <p className="text-xs text-red-400 text-center">
              Nemáš čipy na tažení — můžeš jen Stát.
            </p>
          )}
        </div>
      )}

      {/* Rozhodnutí o tažené kartě */}
      {pending && (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-sm text-slate-300 mb-3 text-center">
            Táhl jsi <strong>{cardLabel(pending)}</strong>.
            Kterou {pending.family === 'sand' ? 'Sand' : 'Blood'} kartu si necháš?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <KeepOption label="Tažená" card={pending} onClick={() => onResolveDraw(true)} />
            <KeepOption label="Původní" card={player.hand[pending.family]} onClick={() => onResolveDraw(false)} />
          </div>
          <p className="mt-3 text-xs text-slate-500 text-center flex items-center justify-center gap-1">
            <HandIcon size={14} /> Druhá karta půjde na odhazovací balíček.
          </p>
        </div>
      )}
    </div>
  )
}

function SourceSlot({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  const clickable = active && !disabled
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={!clickable}
        className={`rounded-lg transition-transform ${
          clickable
            ? 'hover:scale-105 ring-2 ring-[#2fd4c4] shadow-[0_0_8px_#2fd4c455] cursor-pointer'
            : 'cursor-default'
        } ${active && disabled ? 'opacity-40' : ''}`}
      >
        {children}
      </button>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}

function KeepOption({
  label,
  card,
  onClick,
}: {
  label: string
  card: Card
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl bg-slate-900 p-3 hover:bg-slate-950 border border-slate-700 hover:border-emerald-400 transition-colors"
    >
      <PlayingCard family={card.family} value={card.value} kind={card.kind} size="md" />
      <span className="text-sm font-semibold text-slate-200 flex items-center gap-1">
        <Check size={16} className="text-emerald-400" />
        {label}
      </span>
    </button>
  )
}
