import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDeck,
  createInitialState,
  handValue,
  evaluateRound,
  startGame,
  drawFromSource,
  resolveDraw,
  stand,
  nextRound,
  canDrawFrom,
  canAffordDraw,
  willEndGame,
  onlyAiRemaining,
  resolveHand,
  previewHandValue,
  handScore,
  compareHandScore,
  type Player,
  type GameState,
  type Card,
  type TokenId,
} from './sabacc.ts'
import { decideAiMove, decideAiKeep, applyAiTurn, decideAiToken } from './ai.ts'
import { canPlayToken, playToken } from './tokens.ts'

function card(family: 'sand' | 'blood', value: number): Card {
  return { id: `${family}-${value}`, family, kind: 'number', value }
}
function sylop(family: 'sand' | 'blood'): Card {
  return { id: `${family}-sylop`, family, kind: 'sylop', value: 0 }
}
function imposter(family: 'sand' | 'blood'): Card {
  return { id: `${family}-imposter`, family, kind: 'imposter', value: 0 }
}

function mkPlayer(
  id: number,
  sandV: number,
  bloodV: number,
  opts: {
    chips?: number
    invested?: number
    isAi?: boolean
    eliminated?: boolean
    tokens?: TokenId[]
    playedTokenThisRound?: boolean
  } = {},
): Player {
  return {
    id,
    name: `P${id}`,
    isAi: opts.isAi ?? false,
    hand: { sand: card('sand', sandV), blood: card('blood', bloodV) },
    standing: false,
    chips: opts.chips ?? 6,
    invested: opts.invested ?? 0,
    eliminated: opts.eliminated ?? false,
    tokens: opts.tokens ?? [],
    playedTokenThisRound: opts.playedTokenThisRound ?? false,
  }
}

/** Stav s prázdnými balíčky (pro testy stand/vyhodnocení). */
function buildState(players: Player[], currentPlayerIndex = 0): GameState {
  return {
    ...createInitialState(),
    phase: 'turn',
    players,
    pot: players.reduce((s, p) => s + p.invested, 0),
    round: 1,
    turn: 1,
    currentPlayerIndex,
    log: [],
  }
}

/** Stav s plnými balíčky (pro testy tažení). */
function stateWithDecks(players: Player[], currentPlayerIndex = 0): GameState {
  return {
    ...buildState(players, currentPlayerIndex),
    decks: { sand: createDeck('sand'), blood: createDeck('blood') },
  }
}

// ── Balíčky a hodnota ───────────────────────────────────────────────────────

test('createDeck: 18 čísel + 1 Sylop + 1 Imposter = 20 karet', () => {
  const deck = createDeck('sand')
  assert.equal(deck.length, 20)
  const numbers = deck.filter((c) => c.kind === 'number')
  assert.equal(numbers.length, 18)
  for (let v = 1; v <= 6; v++) assert.equal(numbers.filter((c) => c.value === v).length, 3)
  assert.equal(deck.filter((c) => c.kind === 'sylop').length, 1)
  assert.equal(deck.filter((c) => c.kind === 'imposter').length, 1)
  assert.ok(deck.every((c) => c.family === 'sand'))
})

test('handValue: absolutní rozdíl', () => {
  assert.equal(handValue({ sand: card('sand', 4), blood: card('blood', 3) }), 1)
  assert.equal(handValue({ sand: card('sand', 2), blood: card('blood', 2) }), 0)
  assert.equal(handValue({ sand: card('sand', 1), blood: card('blood', 6) }), 5)
})

test('evaluateRound: sólo nejnižší vyhrává; remíza = null', () => {
  assert.equal(evaluateRound([mkPlayer(0, 5, 5), mkPlayer(1, 6, 4), mkPlayer(2, 1, 4)]), 0)
  assert.equal(evaluateRound([mkPlayer(0, 3, 3), mkPlayer(1, 5, 5), mkPlayer(2, 1, 4)]), null)
})

// ── Setup a čipy ────────────────────────────────────────────────────────────

test('startGame: 1 člověk + N AI, čipy nastavené, ruce rozdané', () => {
  const s = startGame({ humanName: 'Ty', numAi: 3, startingChips: 8, humanTokens: ['freeDraw', 'refund', 'embezzlement'] })
  assert.equal(s.players.length, 4)
  assert.equal(s.players[0].isAi, false)
  assert.ok(s.players.slice(1).every((p) => p.isAi))
  assert.ok(s.players.every((p) => p.chips === 8 && p.invested === 0))
  assert.equal(s.phase, 'turn') // index 0 = člověk
  assert.equal(s.pot, 0)
  for (const p of s.players) {
    assert.equal(p.hand.sand.family, 'sand')
    assert.equal(p.hand.blood.family, 'blood')
  }
})

test('startGame: úvodní odhoz — 1 otočená karta na každé hromádce z balíčku', () => {
  const s = startGame({ humanName: 'Ty', numAi: 3, startingChips: 6, humanTokens: ['freeDraw', 'refund', 'embezzlement'] }) // 4 hráči
  assert.equal(s.discards.sand.length, 1)
  assert.equal(s.discards.blood.length, 1)
  assert.equal(s.discards.sand[0].family, 'sand')
  assert.equal(s.discards.blood[0].family, 'blood')
  // balíček = 20 − 4 ruce − 1 úvodní odhoz = 15; žádné karty navíc
  assert.equal(s.decks.sand.length, 20 - 4 - 1)
  assert.equal(s.decks.blood.length, 20 - 4 - 1)
})

test('nextRound: nové kolo má taky úvodní odhoz na obou hromádkách', () => {
  let s = buildState([
    mkPlayer(0, 3, 3, { chips: 5, invested: 1 }),
    mkPlayer(1, 5, 4, { chips: 5, invested: 1 }),
  ])
  s = stand(s)
  s = stand(s) // → reveal
  s = nextRound(s)
  assert.notEqual(s.phase, 'gameover')
  assert.equal(s.discards.sand.length, 1)
  assert.equal(s.discards.blood.length, 1)
})

test('drawFromSource: zaplatí čip do potu, zvýší invested, nastaví pendingDraw', () => {
  let s = stateWithDecks([mkPlayer(0, 5, 2, { chips: 6 }), mkPlayer(1, 3, 3)])
  s = drawFromSource(s, 'sandDeck')
  assert.ok(s.pendingDraw)
  assert.equal(s.pendingDraw!.family, 'sand')
  assert.equal(s.players[0].chips, 5)
  assert.equal(s.players[0].invested, 1)
  assert.equal(s.pot, 1)
})

test('draw nelze bez čipů (canAffordDraw=false, stav beze změny)', () => {
  const s = stateWithDecks([mkPlayer(0, 5, 2, { chips: 0 }), mkPlayer(1, 3, 3)])
  assert.equal(canAffordDraw(s), false)
  const after = drawFromSource(s, 'sandDeck')
  assert.equal(after, s) // beze změny
})

test('resolveDraw: invariant 1 sand + 1 blood, odhozená na discard', () => {
  let s = stateWithDecks([mkPlayer(0, 5, 2, { chips: 6 }), mkPlayer(1, 3, 3)])
  s = drawFromSource(s, 'sandDeck')
  s = resolveDraw(s, true)
  assert.equal(s.pendingDraw, null)
  assert.equal(s.players[0].hand.sand.family, 'sand')
  assert.equal(s.players[0].hand.blood.family, 'blood')
  assert.equal(s.discards.sand.length, 1)
})

test('canDrawFrom: prázdný discard nelze, deck lze', () => {
  const s = stateWithDecks([mkPlayer(0, 1, 1), mkPlayer(1, 1, 1)])
  assert.equal(canDrawFrom(s, 'sandDeck'), true)
  assert.equal(canDrawFrom(s, 'sandDiscard'), false)
})

// ── Vyhodnocení kola s čipy ─────────────────────────────────────────────────

test('reveal: vítěz dostane vklad zpět, prohrávající platí penále = hodnota; pot se vyprázdní', () => {
  // P0: Sabacc (0), vsadil 2 → chips 4; P1: rozdíl 3, vsadil 1 → chips 5
  let s = buildState([
    mkPlayer(0, 4, 4, { chips: 4, invested: 2 }),
    mkPlayer(1, 6, 3, { chips: 5, invested: 1 }),
  ])
  assert.equal(s.pot, 3)
  s = stand(s) // P0
  s = stand(s) // P1 → reveal
  assert.equal(s.phase, 'reveal')
  assert.equal(s.roundWinnerId, 0)
  assert.equal(s.players[0].chips, 6) // vrátily se vsazené 2
  assert.equal(s.players[1].chips, 2) // 5 − penále 3
  assert.equal(s.pot, 0)
  const r1 = s.roundResults!.find((r) => r.playerId === 1)!
  assert.equal(r1.penalty, 3)
  assert.equal(r1.isWinner, false)
})

test('reveal: remíza při shodné síle ruky → oba vklad zpět, žádný vítěz; třetí platí', () => {
  let s = buildState([
    mkPlayer(0, 2, 3, { chips: 5, invested: 1 }), // rozdíl 1, součet 5
    mkPlayer(1, 3, 2, { chips: 4, invested: 2 }), // rozdíl 1, součet 5 → shodné skóre
    mkPlayer(2, 6, 2, { chips: 5, invested: 1 }), // rozdíl 4
  ])
  s = stand(s)
  s = stand(s)
  s = stand(s)
  assert.equal(s.phase, 'reveal')
  assert.equal(s.roundWinnerId, null)
  assert.equal(s.players[0].chips, 6) // refund 1
  assert.equal(s.players[1].chips, 6) // refund 2
  assert.equal(s.players[2].chips, 1) // penále 4
  const r0 = s.roundResults!.find((r) => r.playerId === 0)!
  assert.equal(r0.isTie, true)
  assert.equal(r0.isWinner, false)
})

test('reveal: penále seříznuté na zásobu, hráč spadne na 0 a je vyřazen', () => {
  let s = buildState([
    mkPlayer(0, 3, 3, { chips: 5, invested: 1 }), // Sabacc → vítěz
    mkPlayer(1, 6, 1, { chips: 2, invested: 0 }), // rozdíl 5, ale jen 2 čipy
  ])
  s = stand(s)
  s = stand(s)
  assert.equal(s.players[1].chips, 0)
  assert.equal(s.players[1].eliminated, true)
  const r1 = s.roundResults!.find((r) => r.playerId === 1)!
  assert.equal(r1.penalty, 2) // seříznuto z 5 na 2
})

// ── Vyřazování a konec partie ───────────────────────────────────────────────

test('nextRound: po vyřazení zbývá 1 → gameover s vítězem', () => {
  let s = buildState([
    mkPlayer(0, 3, 3, { chips: 5, invested: 1 }),
    mkPlayer(1, 6, 1, { chips: 2 }),
  ])
  s = stand(s)
  s = stand(s) // P1 vyřazen
  assert.equal(willEndGame(s), true)
  s = nextRound(s)
  assert.equal(s.phase, 'gameover')
  assert.equal(s.gameWinnerId, 0)
})

test('nextRound: zbývá >1 → nové kolo, vyřazený zůstává, ostatní mají invested 0', () => {
  let s = buildState([
    mkPlayer(0, 3, 3, { chips: 5, invested: 1 }), // vítěz
    mkPlayer(1, 5, 4, { chips: 5, invested: 1 }), // rozdíl 1, přežije
    mkPlayer(2, 6, 1, { chips: 1, invested: 0 }), // rozdíl 5 → vyřazen
  ])
  s = stand(s)
  s = stand(s)
  s = stand(s)
  assert.equal(s.players[2].eliminated, true)
  assert.equal(willEndGame(s), false)
  const r = s.round
  s = nextRound(s)
  assert.equal(s.round, r + 1)
  assert.notEqual(s.phase, 'gameover')
  assert.equal(s.players[2].eliminated, true)
  assert.ok(s.players.filter((p) => !p.eliminated).every((p) => p.invested === 0 && !p.standing))
  assert.equal(s.pot, 0)
})

test('vyřazený hráč se v kole přeskakuje', () => {
  let s = buildState([
    mkPlayer(0, 1, 1, { eliminated: true }),
    mkPlayer(1, 2, 2, { chips: 5 }),
  ])
  // currentPlayerIndex 0 je vyřazený — ale logika tahů by ho měla přeskočit;
  // simulujeme tak, že index ukazuje na aktivního:
  s = { ...s, currentPlayerIndex: 1 }
  s = stand(s) // jediný aktivní stojí → reveal
  assert.equal(s.phase, 'reveal')
})

test('onlyAiRemaining: true až když je člověk vyřazen a zbývají jen AI', () => {
  const human = mkPlayer(0, 1, 1, { isAi: false })
  const ai1 = mkPlayer(1, 1, 1, { isAi: true })
  const ai2 = mkPlayer(2, 1, 1, { isAi: true })
  assert.equal(onlyAiRemaining(buildState([human, ai1, ai2])), false)
  assert.equal(
    onlyAiRemaining(buildState([{ ...human, eliminated: true }, ai1, ai2])),
    true,
  )
  // jen vyřazený člověk a jedno AI → stále jen AI zbývá
  assert.equal(
    onlyAiRemaining(buildState([{ ...human, eliminated: true }, ai1, { ...ai2, eliminated: true }])),
    true,
  )
})

// ── AI heuristika ───────────────────────────────────────────────────────────

test('decideAiMove: dobrá ruka (≤1) → Stát', () => {
  const s = stateWithDecks([mkPlayer(0, 4, 4, { isAi: true })])
  assert.deepEqual(decideAiMove(s, 0), { action: 'stand' })
})

test('decideAiMove: bez čipů → Stát', () => {
  const s = stateWithDecks([mkPlayer(0, 6, 1, { isAi: true, chips: 0 })])
  assert.deepEqual(decideAiMove(s, 0), { action: 'stand' })
})

test('decideAiMove: hodnota 2 → náhoda rozhodne (stát vs táhnout)', () => {
  const s = stateWithDecks([mkPlayer(0, 5, 3, { isAi: true, chips: 5 })])
  assert.deepEqual(decideAiMove(s, 0, () => 0.01), { action: 'stand' }) // <15 %
  const m = decideAiMove(s, 0, () => 0.99)
  assert.equal(m.action, 'draw')
})

test('decideAiMove: mění rodinu s vyšší hodnotou (z balíčku)', () => {
  const s = stateWithDecks([mkPlayer(0, 5, 2, { isAi: true, chips: 5 })]) // sand vyšší
  const m = decideAiMove(s, 0, () => 0.99)
  assert.deepEqual(m, { action: 'draw', source: 'sandDeck' })
})

test('decideAiMove: vezme z odhozu, když to ruku zlepší', () => {
  let s = stateWithDecks([mkPlayer(0, 6, 2, { isAi: true, chips: 5 })]) // diff 4
  s = { ...s, discards: { sand: [card('sand', 3)], blood: [] } } // 3 → diff 1 < 4
  const m = decideAiMove(s, 0, () => 0.99)
  assert.deepEqual(m, { action: 'draw', source: 'sandDiscard' })
})

test('decideAiKeep: nechá kartu s nižším rozdílem', () => {
  const hand = { sand: card('sand', 6), blood: card('blood', 2) }
  assert.equal(decideAiKeep(hand, card('sand', 3)), true) // 3 vs 2 = 1 < 4
  assert.equal(decideAiKeep(hand, card('sand', 6)), false) // beze změny
})

test('applyAiTurn: AI táhne, zaplatí čip, zachová invariant, doplní log', () => {
  let s = stateWithDecks([
    mkPlayer(0, 6, 1, { isAi: true, chips: 5 }), // diff 5 → táhne
    mkPlayer(1, 3, 3, { chips: 5 }),
  ])
  s = { ...s, phase: 'aiTurn' }
  s = applyAiTurn(s, () => 0.99)
  assert.equal(s.players[0].invested, 1)
  assert.equal(s.players[0].chips, 4)
  assert.equal(s.players[0].hand.sand.family, 'sand')
  assert.equal(s.players[0].hand.blood.family, 'blood')
  assert.equal(s.log.length, 1)
  assert.equal(s.pendingDraw, null)
})

test('applyAiTurn: dobrá ruka → AI stojí, log obsahuje "stojí"', () => {
  let s = stateWithDecks([
    mkPlayer(0, 4, 4, { isAi: true, chips: 5 }),
    mkPlayer(1, 3, 3, { chips: 5 }),
  ])
  s = { ...s, phase: 'aiTurn' }
  s = applyAiTurn(s)
  assert.ok(s.players[0].standing)
  assert.ok(s.log[0].includes('stojí'))
})

// ── Speciální karty: resolveHand ────────────────────────────────────────────

const die = (n: number) => () => n // deterministická „kostka"

test('resolveHand: Sylop se vyrovná druhé kartě → rozdíl 0', () => {
  const rh = resolveHand({ sand: sylop('sand'), blood: card('blood', 4) })
  assert.equal(rh.value, 0)
  assert.equal(rh.isPureSabacc, false)
  assert.deepEqual(rh.sylopMatched, { family: 'sand', value: 4 })
})

test('resolveHand: dva Sylopy = Pure Sabacc (ne vyrovnání)', () => {
  const rh = resolveHand({ sand: sylop('sand'), blood: sylop('blood') })
  assert.equal(rh.isPureSabacc, true)
  assert.equal(rh.value, 0)
  assert.equal(rh.sylopMatched, null)
})

test('resolveHand: Imposter hodí kostkou jednou, hodnota = hod', () => {
  const rh = resolveHand({ sand: imposter('sand'), blood: card('blood', 2) }, die(5))
  assert.equal(rh.sand, 5)
  assert.equal(rh.value, 3) // |5-2|
  assert.deepEqual(rh.imposterRolls, [{ family: 'sand', roll: 5 }])
})

test('resolveHand: Sylop + Imposter → nejdřív Imposter, pak Sylop na jeho hodnotu', () => {
  const rh = resolveHand({ sand: sylop('sand'), blood: imposter('blood') }, die(6))
  assert.equal(rh.blood, 6)
  assert.equal(rh.sand, 6) // Sylop se vyrovnal hodu Imposteru
  assert.equal(rh.value, 0)
  assert.deepEqual(rh.sylopMatched, { family: 'sand', value: 6 })
})

test('resolveHand: dva Imposteři → dva hody, rozdíl z nich', () => {
  let calls = 0
  const seq = () => (calls++ === 0 ? 4 : 1)
  const rh = resolveHand({ sand: imposter('sand'), blood: imposter('blood') }, seq)
  assert.equal(rh.value, 3) // |4-1|
  assert.equal(rh.imposterRolls.length, 2)
})

test('previewHandValue: Imposter → neznámá hodnota; Sylop → Sabacc; dva Sylopy → Pure', () => {
  assert.deepEqual(previewHandValue({ sand: imposter('sand'), blood: card('blood', 2) }), {
    value: null,
    isSabacc: false,
    isPureSabacc: false,
    hasImposter: true,
  })
  const syl = previewHandValue({ sand: sylop('sand'), blood: card('blood', 5) })
  assert.equal(syl.value, 0)
  assert.equal(syl.isSabacc, true)
  const pure = previewHandValue({ sand: sylop('sand'), blood: sylop('blood') })
  assert.equal(pure.isPureSabacc, true)
})

// ── Pure Sabacc ve vyhodnocení kola ─────────────────────────────────────────

function mkHandPlayer(
  id: number,
  sand: Card,
  blood: Card,
  opts: { chips?: number; invested?: number; tokens?: TokenId[]; isAi?: boolean } = {},
): Player {
  return {
    id,
    name: `P${id}`,
    isAi: opts.isAi ?? false,
    hand: { sand, blood },
    standing: false,
    chips: opts.chips ?? 6,
    invested: opts.invested ?? 0,
    eliminated: false,
    tokens: opts.tokens ?? [],
    playedTokenThisRound: false,
  }
}

test('endRound: Pure Sabacc poráží i běžný Sabacc (rozdíl 0)', () => {
  let s = buildState([
    mkHandPlayer(0, sylop('sand'), sylop('blood'), { chips: 5, invested: 1 }), // Pure Sabacc
    mkHandPlayer(1, card('sand', 3), card('blood', 3), { chips: 5, invested: 1 }), // běžný Sabacc 0
  ])
  s = stand(s)
  s = stand(s)
  assert.equal(s.phase, 'reveal')
  assert.equal(s.roundWinnerId, 0)
  const r0 = s.roundResults!.find((r) => r.playerId === 0)!
  const r1 = s.roundResults!.find((r) => r.playerId === 1)!
  assert.equal(r0.resolved.isPureSabacc, true)
  assert.equal(r0.isWinner, true)
  assert.equal(r1.isWinner, false)
  // P1 prohrál s rozdílem 0 → penále 1 čip (Sabacc ale prohra)
  assert.equal(r1.penalty, 1)
})

// ── AI se speciálními kartami ────────────────────────────────────────────────

test('decideAiMove: se Sylopem v ruce → Stát (efektivně rozdíl 0)', () => {
  const s = stateWithDecks([mkHandPlayer(0, sylop('sand'), card('blood', 6), { chips: 5 })])
  const ai = { ...s, players: [{ ...s.players[0], isAi: true }] }
  assert.deepEqual(decideAiMove(ai, 0), { action: 'stand' })
})

test('decideAiKeep: taženého Sylopa si vždy nech', () => {
  const hand = { sand: card('sand', 6), blood: card('blood', 1) }
  assert.equal(decideAiKeep(hand, sylop('sand')), true)
})

test('decideAiKeep: Imposter si nech jen když zlepší (3,5 vs stávající)', () => {
  // stávající ruka sand 6 / blood 1 → rozdíl 5; s Imposterem ~|3.5-1|=2.5 < 5 → vzít
  assert.equal(decideAiKeep({ sand: card('sand', 6), blood: card('blood', 1) }, imposter('sand')), true)
  // stávající sand 2 / blood 1 → rozdíl 1; s Imposterem ~|3.5-1|=2.5 > 1 → nechat původní
  assert.equal(decideAiKeep({ sand: card('sand', 2), blood: card('blood', 1) }, imposter('sand')), false)
})

// ── Skóre síly ruky (tie-break) ──────────────────────────────────────────────

const scoreOf = (sand: Card, blood: Card) => handScore(resolveHand({ sand, blood }))
const numScore = (s: number, b: number) => scoreOf(card('sand', s), card('blood', b))
const better = (a: number[], b: number[]) => compareHandScore(a, b) < 0

test('handScore: Pure Sabacc je nejlepší', () => {
  const pure = handScore(resolveHand({ sand: sylop('sand'), blood: sylop('blood') }))
  assert.ok(better(pure, numScore(1, 1))) // Pure < 1/1
})

test('handScore: 1/1 je lepší Sabacc než 6/6', () => {
  assert.ok(better(numScore(1, 1), numScore(6, 6)))
  // celé pořadí 1/1 < 2/2 < … < 6/6
  for (let v = 1; v < 6; v++) assert.ok(better(numScore(v, v), numScore(v + 1, v + 1)))
})

test('handScore: Sylop+1 = jako 1/1 (Prime Sabacc)', () => {
  assert.equal(compareHandScore(scoreOf(sylop('sand'), card('blood', 1)), numScore(1, 1)), 0)
  assert.equal(compareHandScore(scoreOf(sylop('sand'), card('blood', 4)), numScore(4, 4)), 0)
  assert.ok(better(scoreOf(sylop('sand'), card('blood', 1)), numScore(2, 2)))
})

test('handScore: jakýkoli Sabacc poráží nenulový rozdíl', () => {
  assert.ok(better(numScore(6, 6), numScore(1, 2))) // 6/6 Sabacc < rozdíl 1
})

test('handScore: menší rozdíl lepší; při shodě rozdílu nižší součet', () => {
  assert.ok(better(numScore(3, 4), numScore(2, 4))) // rozdíl 1 < rozdíl 2
  assert.ok(better(numScore(1, 2), numScore(5, 6))) // oba rozdíl 1, nižší součet vyhrává
})

test('handScore: dva 3/3 jsou shodné → remíza', () => {
  assert.equal(compareHandScore(numScore(3, 3), numScore(3, 3)), 0)
})

// ── endRound s novým pořadím ─────────────────────────────────────────────────

test('endRound: 2/2 poráží 4/4 (žádná remíza nul)', () => {
  let s = buildState([
    mkPlayer(0, 2, 2, { chips: 5, invested: 1 }),
    mkPlayer(1, 4, 4, { chips: 5, invested: 1 }),
  ])
  s = stand(s)
  s = stand(s)
  assert.equal(s.roundWinnerId, 0)
  const r1 = s.roundResults!.find((r) => r.playerId === 1)!
  assert.equal(r1.isWinner, false)
  assert.equal(r1.penalty, 1) // prohraný Sabacc → 1 čip
})

test('endRound: dva 3/3 → remíza (oba refund, nikdo nebere)', () => {
  let s = buildState([
    mkPlayer(0, 3, 3, { chips: 5, invested: 2 }),
    mkPlayer(1, 3, 3, { chips: 5, invested: 1 }),
  ])
  s = stand(s)
  s = stand(s)
  assert.equal(s.roundWinnerId, null)
  assert.ok(s.roundResults!.every((r) => r.isTie && r.penalty === 0))
  assert.equal(s.players[0].chips, 7) // refund 2
  assert.equal(s.players[1].chips, 6) // refund 1
})

test('endRound: Sylop+1 poráží 2/2', () => {
  let s = buildState([
    mkHandPlayer(0, sylop('sand'), card('blood', 1), { chips: 5, invested: 1 }),
    mkHandPlayer(1, card('sand', 2), card('blood', 2), { chips: 5, invested: 1 }),
  ])
  s = stand(s)
  s = stand(s)
  assert.equal(s.roundWinnerId, 0)
})

// ── Shift Tokeny (F3b) ───────────────────────────────────────────────────────

test('startGame: člověk dostane své tokeny, každé AI 3 náhodné', () => {
  const toks: TokenId[] = ['freeDraw', 'refund', 'targetTariff']
  const s = startGame({ humanName: 'Ty', numAi: 3, startingChips: 6, humanTokens: toks })
  assert.deepEqual(s.players[0].tokens, toks)
  assert.ok(s.players.slice(1).every((p) => p.tokens.length === 3))
  assert.ok(s.players.every((p) => !p.playedTokenThisRound))
})

test('Refund: vrátí čipy z potu, sníží invested i pot, spotřebuje token', () => {
  let s = buildState([mkPlayer(0, 5, 2, { chips: 3, invested: 2, tokens: ['refund'] }), mkPlayer(1, 3, 3)])
  assert.equal(s.pot, 2)
  s = playToken(s, 'refund')
  assert.equal(s.players[0].chips, 5) // 3 + 2 zpět
  assert.equal(s.players[0].invested, 0)
  assert.equal(s.pot, 0)
  assert.equal(s.players[0].tokens.includes('refund'), false)
  assert.equal(s.players[0].playedTokenThisRound, true)
})

test('Refund: nevrátí víc, než hráč vsadil (cap na invested)', () => {
  let s = buildState([mkPlayer(0, 5, 2, { chips: 3, invested: 1, tokens: ['refund'] }), mkPlayer(1, 3, 3)])
  s = playToken(s, 'refund')
  assert.equal(s.players[0].chips, 4) // jen 1 zpět
  assert.equal(s.players[0].invested, 0)
})

test('Refund: nelze bez vlastního vkladu v potu', () => {
  const s = buildState([mkPlayer(0, 5, 2, { chips: 3, invested: 0, tokens: ['refund'] }), mkPlayer(1, 3, 3)])
  assert.equal(canPlayToken(s, 'refund'), false)
  assert.equal(playToken(s, 'refund'), s) // beze změny
})

test('Embezzlement: vezme 1 čip od každého soupeře s čipy (0 od bezčipého)', () => {
  let s = buildState([
    mkPlayer(0, 5, 2, { chips: 5, tokens: ['embezzlement'] }),
    mkPlayer(1, 3, 3, { chips: 3 }),
    mkPlayer(2, 3, 3, { chips: 0 }),
  ])
  s = playToken(s, 'embezzlement')
  assert.equal(s.players[0].chips, 6) // +1 (jen od P1)
  assert.equal(s.players[1].chips, 2)
  assert.equal(s.players[2].chips, 0)
})

test('General Tariff: soupeři platí 1 čip do potu (invested++), bezčipý neplatí', () => {
  let s = buildState([
    mkPlayer(0, 5, 2, { chips: 5, tokens: ['generalTariff'] }),
    mkPlayer(1, 3, 3, { chips: 3 }),
    mkPlayer(2, 3, 3, { chips: 0 }),
  ])
  s = playToken(s, 'generalTariff')
  assert.equal(s.players[1].chips, 2)
  assert.equal(s.players[1].invested, 1)
  assert.equal(s.players[2].chips, 0)
  assert.equal(s.pot, 1)
})

test('Target Tariff: cíl platí 2 čipy do potu, cap na jeho zásobu', () => {
  let s = buildState([
    mkPlayer(0, 5, 2, { chips: 5, tokens: ['targetTariff'] }),
    mkPlayer(1, 3, 3, { chips: 1 }), // má jen 1 → zaplatí 1
  ])
  assert.equal(canPlayToken(s, 'targetTariff', 1), true)
  s = playToken(s, 'targetTariff', 1)
  assert.equal(s.players[1].chips, 0)
  assert.equal(s.pot, 1)
})

test('max 1 token za kolo: druhý token už nelze', () => {
  let s = buildState([
    mkPlayer(0, 5, 2, { chips: 3, invested: 2, tokens: ['refund', 'freeDraw'] }),
    mkPlayer(1, 3, 3),
  ])
  s = playToken(s, 'refund')
  assert.equal(s.players[0].playedTokenThisRound, true)
  assert.equal(canPlayToken(s, 'freeDraw'), false)
  assert.equal(playToken(s, 'freeDraw'), s)
})

test('Free Draw: další tažení je zdarma a token se spotřebuje', () => {
  let s = stateWithDecks([mkPlayer(0, 6, 1, { chips: 0, tokens: ['freeDraw'] }), mkPlayer(1, 3, 3)])
  s = playToken(s, 'freeDraw')
  assert.equal(s.freeDrawActive, true)
  assert.equal(canAffordDraw(s), true) // i s 0 čipy
  s = drawFromSource(s, 'sandDeck')
  assert.ok(s.pendingDraw)
  assert.equal(s.players[0].chips, 0) // nic nezaplaceno
  assert.equal(s.pot, 0)
  assert.equal(s.freeDrawActive, false) // spotřebováno
})

test('Free Draw se nepřenese do dalšího tahu, když hráč jen stojí', () => {
  let s = buildState([mkPlayer(0, 6, 1, { chips: 5, tokens: ['freeDraw'] }), mkPlayer(1, 3, 3)])
  s = playToken(s, 'freeDraw')
  assert.equal(s.freeDrawActive, true)
  s = stand(s) // přejde na dalšího hráče
  assert.equal(s.freeDrawActive, false)
})

test('decideAiToken: Free Draw když chce táhnout a má málo čipů', () => {
  const s = buildState([
    mkPlayer(0, 6, 1, { isAi: true, chips: 1, tokens: ['freeDraw'] }),
    mkPlayer(1, 3, 3),
  ])
  const move = { action: 'draw', source: 'sandDeck' } as const
  assert.deepEqual(decideAiToken(s, 0, move, () => 0.1), { token: 'freeDraw' })
})

test('decideAiToken: nic, když token nevlastní nebo už hrál', () => {
  const s = buildState([
    mkPlayer(0, 6, 1, { isAi: true, chips: 1, tokens: ['freeDraw'], playedTokenThisRound: true }),
    mkPlayer(1, 3, 3),
  ])
  assert.equal(decideAiToken(s, 0, { action: 'draw', source: 'sandDeck' }, () => 0.1), null)
})

test('čipy nikdy do záporu po tokenech (Tariff/Embezzlement)', () => {
  let s = buildState([
    mkPlayer(0, 5, 2, { chips: 0, tokens: ['targetTariff'] }),
    mkPlayer(1, 3, 3, { chips: 0 }),
  ])
  s = playToken(s, 'targetTariff', 1)
  assert.ok(s.players.every((p) => p.chips >= 0))
  assert.equal(s.pot, 0) // cíl neměl co platit
})
