// Heuristika AI soupeřů — čistě lokální, bez API a bez side-efektů.
// Náhoda se injektuje parametrem `rng`, takže rozhodování je testovatelné.

import {
  canDrawFrom,
  canAffordDraw,
  drawFromSource,
  resolveDraw,
  stand,
  type GameState,
  type Hand,
  type Family,
  type Card,
  type DrawSource,
  type TokenId,
} from './sabacc.ts'
import { canPlayToken, playToken } from './tokens.ts'

export type AiMove = { action: 'stand' } | { action: 'draw'; source: DrawSource }

/** Pravděpodobnost, že AI i s rukou hodnoty 2 raději zůstane stát. */
const STAND_AT_TWO_CHANCE = 0.15
/** Očekávaná hodnota Imposteru, dokud nepadne kostka (průměr 1–6). */
const IMPOSTER_EXPECTED = 3.5

const otherFamily = (f: Family): Family => (f === 'sand' ? 'blood' : 'sand')

/** Číselný odhad karty pro AI: číslo = hodnota, Imposter = ~3,5, Sylop = null. */
function cardEstimate(card: Card): number | null {
  if (card.kind === 'number') return card.value
  if (card.kind === 'imposter') return IMPOSTER_EXPECTED
  return null // Sylop — vyrovná se druhé kartě
}

/**
 * Odhad hodnoty ruky pro AI (nižší lepší). Sylop se vyrovná druhé kartě
 * (→ efektivně 0), dva Sylopy = Pure Sabacc (0), Imposter ~3,5.
 */
function estimateHand(hand: Hand): number {
  const s = cardEstimate(hand.sand)
  const b = cardEstimate(hand.blood)
  if (s === null || b === null) return 0 // Sylop přítomen → vyrovná na rozdíl 0
  return Math.abs(s - b)
}

function sourceLabel(source: DrawSource): string {
  switch (source) {
    case 'sandDeck':
      return 'z balíčku Sand'
    case 'bloodDeck':
      return 'z balíčku Blood'
    case 'sandDiscard':
      return 'z odhozu Sand'
    case 'bloodDiscard':
      return 'z odhozu Blood'
  }
}

/** Vrátí první dostupný (neprázdný) zdroj z preferenčního pořadí, jinak null. */
function firstAvailable(state: GameState, order: DrawSource[]): DrawSource | null {
  for (const s of order) {
    if (canDrawFrom(state, s)) return s
  }
  return null
}

/**
 * Rozhodne tah AI hráče: Stát, nebo Táhnout z konkrétního zdroje.
 * - odhad ruky ≤ 1 → Stát (mj. Sylop = 0 → výborná ruka, neplýtvej čipy)
 * - nemá čip na draw → Stát
 * - odhad 2 → ~15 % šance na Stát, jinak Táhnout
 * - jinak Táhnout: mění rodinu s vyšším odhadem; pokud vrchní odhoz té rodiny
 *   ruku zlepší (vč. Sylopu na odhozu), vezme ho odtud, jinak z balíčku.
 */
export function decideAiMove(
  state: GameState,
  playerId: number,
  rng: () => number = Math.random,
): AiMove {
  const player = state.players.find((p) => p.id === playerId)!
  const value = estimateHand(player.hand)

  if (value <= 1) return { action: 'stand' }
  if (!canAffordDraw(state)) return { action: 'stand' }
  if (value === 2 && rng() < STAND_AT_TWO_CHANCE) return { action: 'stand' }

  // V téhle větvi není v ruce Sylop (ten by dal odhad 0 → Stát), takže odhady
  // obou karet jsou čísla (číslo nebo Imposter ~3,5).
  const sandEst = cardEstimate(player.hand.sand)!
  const bloodEst = cardEstimate(player.hand.blood)!
  const higher: Family = sandEst >= bloodEst ? 'sand' : 'blood'
  const otherEst = higher === 'sand' ? bloodEst : sandEst

  const higherDiscard: DrawSource = higher === 'sand' ? 'sandDiscard' : 'bloodDiscard'
  const higherDeck: DrawSource = higher === 'sand' ? 'sandDeck' : 'bloodDeck'

  // Vrchní odhoz té rodiny: Sylop vždy zlepší (→ rozdíl 0), jinak porovnej odhad.
  const top = state.discards[higher].at(-1)
  let preferDiscard = false
  if (top) {
    if (top.kind === 'sylop') preferDiscard = true
    else preferDiscard = Math.abs(cardEstimate(top)! - otherEst) < value
  }

  const order: DrawSource[] = preferDiscard
    ? [higherDiscard, higherDeck]
    : [higherDeck, higherDiscard]
  // Defenzivní fallback na druhou rodinu, kdyby vlastní byla nedostupná.
  const lower = otherFamily(higher)
  order.push(lower === 'sand' ? 'sandDeck' : 'bloodDeck')
  order.push(lower === 'sand' ? 'sandDiscard' : 'bloodDiscard')

  const source = firstAvailable(state, order)
  if (!source) return { action: 'stand' }
  return { action: 'draw', source }
}

/**
 * Po odhalení tažené karty rozhodne, zda si ji AI nechá: vybere variantu s
 * nižším odhadem ruky. Sylop = vždy si ho nech (rozdíl 0); Imposter (~3,5) jen
 * pokud je lepší než stávající karta. Při shodě nemění.
 */
export function decideAiKeep(hand: Hand, drawn: Card): boolean {
  const estKeepDrawn = estimateHand({ ...hand, [drawn.family]: drawn })
  const estKeepExisting = estimateHand(hand)
  return estKeepDrawn < estKeepExisting
}

function appendLog(state: GameState, msg: string): GameState {
  return { ...state, log: [...state.log, msg].slice(-6) }
}

/**
 * Rozhodne, zda (a jaký) Shift Token AI zahraje před svou akcí — max 1 za kolo.
 * Heuristika dle plánovaného tahu a pozice; s drobnou náhodou (rng seedovatelná).
 * Vrací null, pokud AI token hrát nechce / nemůže.
 */
export function decideAiToken(
  state: GameState,
  playerId: number,
  intendedMove: AiMove,
  rng: () => number = Math.random,
): { token: TokenId; targetId?: number } | null {
  const me = state.players.find((p) => p.id === playerId)!
  if (me.playedTokenThisRound || me.tokens.length === 0) return null

  const owns = (t: TokenId) => me.tokens.includes(t)
  const est = estimateHand(me.hand)
  const goodHand = est <= 1
  const weakHand = est >= 3
  const oppWithChips = state.players.filter((p) => p.id !== me.id && !p.eliminated && p.chips > 0)

  // Free Draw: chystá se táhnout a má málo čipů → ušetři čip.
  if (owns('freeDraw') && intendedMove.action === 'draw' && me.chips <= 2 && canPlayToken(state, 'freeDraw') && rng() < 0.85) {
    return { token: 'freeDraw' }
  }

  // Refund / Extra Refund: slabší ruka a dost vsazeno → pojisti si čipy.
  if (owns('extraRefund') && me.invested >= 3 && weakHand && canPlayToken(state, 'extraRefund') && rng() < 0.6) {
    return { token: 'extraRefund' }
  }
  if (owns('refund') && me.invested >= 2 && weakHand && canPlayToken(state, 'refund') && rng() < 0.6) {
    return { token: 'refund' }
  }

  // Target Tariff: dobrá-ish ruka → přitlač. Cíl: lídr-člověk, jinak nejslabší.
  if (owns('targetTariff') && oppWithChips.length > 0 && est <= 2 && rng() < 0.5) {
    const leader = oppWithChips.reduce((a, b) => (b.chips > a.chips ? b : a))
    const weakest = oppWithChips.reduce((a, b) => (b.chips < a.chips ? b : a))
    const human = oppWithChips.find((o) => !o.isAi)
    const target = human && human.id === leader.id ? human : weakest
    if (canPlayToken(state, 'targetTariff', target.id)) return { token: 'targetTariff', targetId: target.id }
  }

  // Embezzlement / General Tariff: dobrá ruka → tlač soupeře k vyřazení.
  if (owns('embezzlement') && oppWithChips.length > 0 && goodHand && canPlayToken(state, 'embezzlement') && rng() < 0.5) {
    return { token: 'embezzlement' }
  }
  if (owns('generalTariff') && oppWithChips.length > 0 && goodHand && canPlayToken(state, 'generalTariff') && rng() < 0.4) {
    return { token: 'generalTariff' }
  }

  return null
}

/**
 * Provede celý tah aktuálního AI hráče: případně zahraje token, pak rozhodne
 * a provede Táhnout/Stát. Vrací nový stav s doplněným logem. Jen ve fázi 'aiTurn'.
 */
export function applyAiTurn(state: GameState, rng: () => number = Math.random): GameState {
  if (state.phase !== 'aiTurn') return state
  const player = state.players[state.currentPlayerIndex]

  // Nejdřív (volitelně) token — podle plánovaného tahu.
  const intended = decideAiMove(state, player.id, rng)
  const tokenPlay = decideAiToken(state, player.id, intended, rng)
  let s = tokenPlay ? playToken(state, tokenPlay.token, tokenPlay.targetId) : state

  // Pak normální akce na (případně upraveném) stavu.
  const cur = s.players[s.currentPlayerIndex]
  const move = decideAiMove(s, cur.id, rng)

  if (move.action === 'stand') {
    return appendLog(stand(s), `${cur.name} stojí.`)
  }
  const afterDraw = drawFromSource(s, move.source)
  if (!afterDraw.pendingDraw) {
    return appendLog(stand(s), `${cur.name} stojí.`)
  }
  const keep = decideAiKeep(cur.hand, afterDraw.pendingDraw)
  const resolved = resolveDraw(afterDraw, keep)
  return appendLog(resolved, `${cur.name} táhl ${sourceLabel(move.source)}.`)
}
