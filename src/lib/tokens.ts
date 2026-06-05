// Shift Tokeny (F3b) — čisté funkce pro aplikaci čipových efektů na stav.
// Bez Reactu, bez side-efektů. Efekty se týkají VÝHRADNĚ čipů (a Free Draw),
// nikdy karet ani vyhodnocení ruky.

import { type GameState, type TokenId } from './sabacc.ts'

/** Metadata tokenů pro UI (název + český popis efektu). */
export const TOKEN_DEFS: Record<TokenId, { name: string; desc: string }> = {
  freeDraw: { name: 'Free Draw', desc: 'Tento tah táhneš zdarma (neplatíš čip).' },
  refund: { name: 'Refund', desc: 'Vrať si 2 čipy z potu (jen cos sám vsadil).' },
  extraRefund: { name: 'Extra Refund', desc: 'Vrať si 3 čipy z potu (jen cos sám vsadil).' },
  embezzlement: { name: 'Embezzlement', desc: 'Vezmi 1 čip od každého soupeře.' },
  generalTariff: { name: 'General Tariff', desc: 'Všichni soupeři platí 1 čip do potu.' },
  targetTariff: { name: 'Target Tariff', desc: 'Vybraný soupeř platí 2 čipy do potu.' },
}

/** Aktivní soupeři aktuálního hráče (nevyřazení, ne on sám). */
function opponentsOf(state: GameState, meId: number) {
  return state.players.filter((p) => p.id !== meId && !p.eliminated)
}

/**
 * Smí aktuální hráč právě teď zahrát daný token?
 * - jen ve svém tahu, před akcí (žádná rozehraná draw), max 1 token za kolo,
 *   token musí vlastnit a nesmí být vyřazen;
 * - Refund/Extra Refund vyžadují, aby měl v potu aspoň 1 vlastní čip;
 * - Embezzlement/General/Target vyžadují aspoň jednoho aktivního soupeře
 *   (Target navíc platný cíl).
 */
export function canPlayToken(state: GameState, token: TokenId, targetId?: number): boolean {
  if (state.phase !== 'turn' && state.phase !== 'aiTurn') return false
  if (state.pendingDraw) return false
  const me = state.players[state.currentPlayerIndex]
  if (!me || me.eliminated) return false
  if (me.playedTokenThisRound) return false
  if (!me.tokens.includes(token)) return false

  const opponents = opponentsOf(state, me.id)
  switch (token) {
    case 'freeDraw':
      return true
    case 'refund':
    case 'extraRefund':
      return me.invested >= 1
    case 'embezzlement':
    case 'generalTariff':
      return opponents.length > 0
    case 'targetTariff':
      return targetId != null && opponents.some((p) => p.id === targetId)
  }
}

function appendLog(state: GameState, msg: string): GameState {
  return { ...state, log: [...state.log, msg].slice(-6) }
}

const chip = (n: number) => `${n} ${n === 1 ? 'čip' : n >= 2 && n <= 4 ? 'čipy' : 'čipů'}`

/**
 * Zahraje token aktuálního hráče: aplikuje čipový efekt, odebere token z jeho
 * zásoby, označí „token zahrán v tomto kole" a doplní log. Při neplatném zahrání
 * vrací stav beze změny. Čipy nikdy nejdou do záporu, pot zůstává konzistentní.
 */
export function playToken(state: GameState, token: TokenId, targetId?: number): GameState {
  if (!canPlayToken(state, token, targetId)) return state

  const idx = state.currentPlayerIndex
  const players = state.players.map((p) => ({ ...p }))
  const me = players[idx]
  let pot = state.pot
  let freeDrawActive = state.freeDrawActive
  let msg: string

  switch (token) {
    case 'freeDraw': {
      freeDrawActive = true
      msg = `${me.name} zahrál Free Draw — tah zdarma.`
      break
    }
    case 'refund':
    case 'extraRefund': {
      const want = token === 'refund' ? 2 : 3
      const amt = Math.min(want, me.invested) // nikdy víc, než hráč vsadil
      me.chips += amt
      me.invested -= amt
      pot -= amt
      msg = `${me.name} zahrál ${TOKEN_DEFS[token].name} — vrátil si ${chip(amt)} z potu.`
      break
    }
    case 'embezzlement': {
      let taken = 0
      for (const p of players) {
        if (p.id !== me.id && !p.eliminated && p.chips > 0) {
          p.chips -= 1
          taken += 1
        }
      }
      me.chips += taken
      msg = `${me.name} zahrál Embezzlement — vzal ${chip(taken)} soupeřům.`
      break
    }
    case 'generalTariff': {
      let paid = 0
      for (const p of players) {
        if (p.id !== me.id && !p.eliminated && p.chips > 0) {
          p.chips -= 1
          p.invested += 1
          paid += 1
        }
      }
      pot += paid
      msg = `${me.name} zahrál General Tariff — soupeři platí ${chip(paid)} do potu.`
      break
    }
    case 'targetTariff': {
      const target = players.find((p) => p.id === targetId)!
      const amt = Math.min(2, target.chips) // kdo nemá tolik, zaplatí kolik má
      target.chips -= amt
      target.invested += amt
      pot += amt
      msg = `${me.name} zahrál Target Tariff na ${target.name} — platí ${chip(amt)} do potu.`
      break
    }
  }

  // Spotřebuj token (jednorázový) a označ, že hráč v tomto kole už token zahrál.
  const ti = me.tokens.indexOf(token)
  me.tokens = me.tokens.filter((_, i) => i !== ti)
  me.playedTokenThisRound = true

  return appendLog({ ...state, players, pot, freeDrawActive }, msg)
}
