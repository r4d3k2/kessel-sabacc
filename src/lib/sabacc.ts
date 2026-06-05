// Kessel Sabacc — čistá herní logika (bez Reactu).
// Fáze 2: čipová ekonomika + AI soupeři. 1 člověk vs 1–3 AI.

// ── Konstanty ─────────────────────────────────────────────────────────────

/** Počet tahů (cyklů) na kolo. */
export const TURNS_PER_ROUND = 3
/** Hodnoty karet v balíčku. */
export const CARD_VALUES = [1, 2, 3, 4, 5, 6] as const
/** Počet kopií od každé hodnoty v jednom balíčku. */
export const COPIES_PER_VALUE = 3
/** Počet Sylop karet v každém balíčku. */
export const SYLOPS_PER_DECK = 1
/** Počet Imposter karet v každém balíčku. */
export const IMPOSTERS_PER_DECK = 1
/** Stěny kostky pro Imposter (1–6). */
export const DIE_SIDES = 6
/** Cena jednoho tažení v čipech. */
export const DRAW_COST = 1
/** Nabízené startovní zásoby čipů. */
export const CHIP_OPTIONS = [4, 6, 8] as const
export const DEFAULT_CHIPS = 6
/** Nabízené počty AI soupeřů. */
export const AI_OPTIONS = [1, 2, 3] as const
/** Star-Wars laděná jména pro AI soupeře (UI zůstává česky). */
export const AI_NAMES = ['Lando', 'Bossk', 'Quint'] as const

// ── Typy ──────────────────────────────────────────────────────────────────

export type Family = 'sand' | 'blood'

/**
 * Druh karty:
 * - 'number'   — běžná karta s pevnou hodnotou 1–6
 * - 'sylop'    — při revealu se vyrovná druhé kartě; dva Sylopy = Pure Sabacc
 * - 'imposter' — při revealu se hodnota určí hodem kostkou (1–6)
 */
export type CardKind = 'number' | 'sylop' | 'imposter'

export interface Card {
  id: string
  family: Family
  kind: CardKind
  /** Pevná hodnota jen u kind === 'number'; u speciálních karet 0 (nepoužitá). */
  value: number
}

/** Ruka hráče: vždy přesně jedna Sand a jedna Blood karta. */
export interface Hand {
  sand: Card
  blood: Card
}

/**
 * Shift Tokeny (F3b) — jednorázové čipové triky. Každý hráč si jich na partii
 * vybere 3 z těchto 6. Efekty se týkají jen čipů, nikdy karet ani vyhodnocení.
 */
export type TokenId =
  | 'freeDraw'
  | 'refund'
  | 'extraRefund'
  | 'embezzlement'
  | 'generalTariff'
  | 'targetTariff'

/** Všech 6 tokenů (pořadí pro výběr a náhodný los AI). */
export const ALL_TOKENS: TokenId[] = [
  'freeDraw',
  'refund',
  'extraRefund',
  'embezzlement',
  'generalTariff',
  'targetTariff',
]
/** Kolik tokenů si každý hráč vybírá na partii. */
export const TOKENS_PER_PLAYER = 3

export interface Player {
  id: number
  name: string
  isAi: boolean
  hand: Hand
  /** Hráč zvolil Stát a v tomto kole už dál nehraje. */
  standing: boolean
  /** Aktuální zásoba čipů. */
  chips: number
  /** Čipy investované do potu v aktuálním kole (počet draws × DRAW_COST). */
  invested: number
  /** Vyřazen ze hry (zásoba klesla na 0). */
  eliminated: boolean
  /** Kolo, ve kterém byl vyřazen (pro přehled na konci). */
  eliminatedRound?: number
  /** Nezahranés Shift Tokeny (jednorázové, mizí po zahrání). */
  tokens: TokenId[]
  /** Už zahrál token v tomto kole? (max 1 za kolo) */
  playedTokenThisRound: boolean
}

export type Phase = 'setup' | 'turn' | 'aiTurn' | 'reveal' | 'gameover'

/** Zdroj, ze kterého hráč táhne kartu. */
export type DrawSource = 'sandDeck' | 'bloodDeck' | 'sandDiscard' | 'bloodDiscard'

/** Výsledek jednoho hráče po vyhodnocení kola (pro reveal obrazovku). */
export interface RoundResult {
  playerId: number
  handValue: number
  /** Detaily vyřešení ruky (Imposter hody, Sylop vyrovnání, Pure Sabacc). */
  resolved: ResolvedHand
  invested: number
  /** Sólo vítěz kola. */
  isWinner: boolean
  /** Součást remízy na nejnižší hodnotě (bez vítěze). */
  isTie: boolean
  /** Vrácené čipy (vítěz / remíza dostávají zpět vklad). */
  refund: number
  /** Zaplacené penále (prohrávající). */
  penalty: number
  /** Čistá změna čipů při vyhodnocení (refund − penalty). */
  delta: number
  /** Zásoba čipů po vyhodnocení. */
  chipsAfter: number
  /** Byl tímto vyhodnocením vyřazen. */
  eliminated: boolean
}

export interface GameConfig {
  humanName: string
  /** Počet AI soupeřů: 1–3. */
  numAi: number
  /** Startovní zásoba čipů pro každého. */
  startingChips: number
  /** 3 tokeny vybrané lidským hráčem. */
  humanTokens: TokenId[]
}

export interface GameState {
  phase: Phase
  players: Player[]
  decks: { sand: Card[]; blood: Card[] }
  /** Odhazovací balíčky — poslední prvek pole je vrchní (lícem nahoru) karta. */
  discards: { sand: Card[]; blood: Card[] }
  /** Pot uprostřed stolu (součet vsazených čipů v tomto kole). */
  pot: number
  /** Aktuální kolo, 1.. */
  round: number
  /** Aktuální tah/cyklus v rámci kola, 1..TURNS_PER_ROUND. */
  turn: number
  /** Index hráče na tahu v poli players. */
  currentPlayerIndex: number
  /** Karta právě tažená, čeká na rozhodnutí kterou nechat. */
  pendingDraw: Card | null
  /** Aktivní efekt Free Draw — nejbližší tažení aktuálního hráče je zdarma. */
  freeDrawActive: boolean
  /** Vítěz právě vyhodnoceného kola, nebo null při remíze. */
  roundWinnerId: number | null
  /** Výsledky posledního vyhodnocení (pro reveal), nebo null. */
  roundResults: RoundResult[] | null
  /** Krátký log akcí AI v aktuálním kole. */
  log: string[]
  /** Vítěz celé partie (na gameover), nebo null při remíze. */
  gameWinnerId: number | null
}

// ── Pomocné funkce: balíčky ─────────────────────────────────────────────────

/** Fisher–Yates zamíchání (vrací novou kopii pole). */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Vytvoří jeden balíček dané rodiny: hodnoty 1–6 po 3 kusech (18 karet)
 * plus Sylop a Imposter karty (dle konstant). Výchozí velikost = 20 karet.
 */
export function createDeck(family: Family): Card[] {
  const deck: Card[] = []
  for (const value of CARD_VALUES) {
    for (let copy = 0; copy < COPIES_PER_VALUE; copy++) {
      deck.push({ id: `${family}-${value}-${copy}`, family, kind: 'number', value })
    }
  }
  for (let i = 0; i < SYLOPS_PER_DECK; i++) {
    deck.push({ id: `${family}-sylop-${i}`, family, kind: 'sylop', value: 0 })
  }
  for (let i = 0; i < IMPOSTERS_PER_DECK; i++) {
    deck.push({ id: `${family}-imposter-${i}`, family, kind: 'imposter', value: 0 })
  }
  return deck
}

// ── Hodnota ruky a vyhodnocení ──────────────────────────────────────────────

/**
 * Hodnota ruky složené jen z číselných karet = absolutní rozdíl hodnot.
 * Pro ruce se speciálními kartami použij resolveHand (reveal) nebo
 * previewHandValue (živý náhled).
 */
export function handValue(hand: Hand): number {
  return Math.abs(hand.sand.value - hand.blood.value)
}

/** Hod šestistěnnou kostkou (1–6). */
export function rollDie(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * DIE_SIDES)
}

/** Vyřešená ruka po revealu (Imposter hozen, Sylop vyrovnán). */
export interface ResolvedHand {
  /** Výsledná hodnota ruky (nižší lepší); u Pure Sabacc 0. */
  value: number
  /** Dva Sylopy = nejlepší možná ruka, vyhrává kolo. */
  isPureSabacc: boolean
  /** Vyřešené hodnoty karet (null jen u Pure Sabacc). */
  sand: number | null
  blood: number | null
  /** Co padlo na kostce u Imposterů. */
  imposterRolls: { family: Family; roll: number }[]
  /** Na jakou hodnotu se vyrovnal Sylop (pokud nějaký jediný v ruce byl). */
  sylopMatched: { family: Family; value: number } | null
}

/**
 * Vyhodnotí ruku ve fázi reveal v přesném pořadí:
 *  1) Imposter — hodí kostkou (1–6), tím se hodnota pevně určí pro toto kolo;
 *  2) Sylop — vyrovná se hodnotě druhé (už vyřešené) karty;
 *  3) dva Sylopy — Pure Sabacc (hodnota 0, vyhrává kolo);
 *  4) jinak — absolutní rozdíl obou vyřešených hodnot.
 * Kostka se injektuje parametrem `roll`, takže je to deterministicky testovatelné.
 */
export function resolveHand(hand: Hand, roll: () => number = () => rollDie()): ResolvedHand {
  const sandIsSylop = hand.sand.kind === 'sylop'
  const bloodIsSylop = hand.blood.kind === 'sylop'

  // 3) Dva Sylopy → Pure Sabacc (Sylop se nikdy nevyrovnává sám sobě).
  if (sandIsSylop && bloodIsSylop) {
    return { value: 0, isPureSabacc: true, sand: null, blood: null, imposterRolls: [], sylopMatched: null }
  }

  const imposterRolls: { family: Family; roll: number }[] = []

  // 1) Vyřeš Imposter(y) a číselné karty.
  let sand: number | null = null
  let blood: number | null = null
  if (hand.sand.kind === 'imposter') {
    sand = roll()
    imposterRolls.push({ family: 'sand', roll: sand })
  } else if (hand.sand.kind === 'number') {
    sand = hand.sand.value
  }
  if (hand.blood.kind === 'imposter') {
    blood = roll()
    imposterRolls.push({ family: 'blood', roll: blood })
  } else if (hand.blood.kind === 'number') {
    blood = hand.blood.value
  }

  // 2) Vyřeš jediný Sylop — vyrovná se druhé, už známé kartě.
  let sylopMatched: { family: Family; value: number } | null = null
  if (sandIsSylop) {
    sand = blood
    sylopMatched = { family: 'sand', value: blood! }
  } else if (bloodIsSylop) {
    blood = sand
    sylopMatched = { family: 'blood', value: sand! }
  }

  return {
    value: Math.abs(sand! - blood!),
    isPureSabacc: false,
    sand,
    blood,
    imposterRolls,
    sylopMatched,
  }
}

/** Náhled hodnoty ruky pro živé UI (bez házení kostkou). */
export interface HandPreview {
  /** Hodnota, pokud je jistá; null když je v ruce Imposter (padne až při revealu). */
  value: number | null
  /** Rozdíl 0 (Sabacc) — Sylop vyrovnaný s číslem nebo dvě stejná čísla. */
  isSabacc: boolean
  /** Dva Sylopy → Pure Sabacc. */
  isPureSabacc: boolean
  /** V ruce je Imposter → hodnota je do revealu neznámá. */
  hasImposter: boolean
}

/** Spočítá náhled hodnoty ruky pro zobrazení hráči (Imposter zůstává „?"). */
export function previewHandValue(hand: Hand): HandPreview {
  const sandIsSylop = hand.sand.kind === 'sylop'
  const bloodIsSylop = hand.blood.kind === 'sylop'
  const hasImposter = hand.sand.kind === 'imposter' || hand.blood.kind === 'imposter'

  if (sandIsSylop && bloodIsSylop) {
    return { value: 0, isSabacc: true, isPureSabacc: true, hasImposter: false }
  }
  if (hasImposter) {
    return { value: null, isSabacc: false, isPureSabacc: false, hasImposter: true }
  }
  if (sandIsSylop || bloodIsSylop) {
    // Sylop se vyrovná druhé (číselné) kartě → rozdíl 0.
    return { value: 0, isSabacc: true, isPureSabacc: false, hasImposter: false }
  }
  const value = Math.abs(hand.sand.value - hand.blood.value)
  return { value, isSabacc: value === 0, isPureSabacc: false, hasImposter: false }
}

/**
 * Skóre síly ruky jako lexikograficky porovnatelný tuple — NIŽŠÍ = LEPŠÍ.
 * Pořadí (od nejlepší po nejhorší):
 *  1) Pure Sabacc (dva Sylopy)            → [0, 0, 0]
 *  2) Sabacc (rozdíl 0) dle hodnoty karet → [1, hodnota, 0]   (1/1 nejlepší … 6/6 nejhorší)
 *  3) nenulový rozdíl                      → [2, rozdíl, součet] (menší rozdíl lepší,
 *                                            při shodě nižší součet karet)
 * Sylop se počítá hodnotou, na kterou se vyrovnal (řeší resolveHand).
 */
export function handScore(resolved: ResolvedHand): number[] {
  if (resolved.isPureSabacc) return [0, 0, 0]
  const sand = resolved.sand!
  const blood = resolved.blood!
  if (resolved.value === 0) return [1, sand, 0]
  return [2, resolved.value, sand + blood]
}

/** Porovná dvě skóre ruky lexikograficky. Záporné = a je lepší (silnější). */
export function compareHandScore(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Vrátí id vítěze kola (nejnižší hodnota ruky) mezi danými hráči, nebo null
 * při remíze na nejnižší hodnotě. Pracuje jen s číselnými rukami — reveal se
 * speciálními kartami řeší endRound přes resolveHand.
 */
export function evaluateRound(players: Player[]): number | null {
  if (players.length === 0) return null
  const min = Math.min(...players.map((p) => handValue(p.hand)))
  const winners = players.filter((p) => handValue(p.hand) === min)
  return winners.length === 1 ? winners[0].id : null
}

// ── Inicializace a rozdání ──────────────────────────────────────────────────

/** Vytvoří výchozí stav (úvodní obrazovka). */
export function createInitialState(): GameState {
  return {
    phase: 'setup',
    players: [],
    decks: { sand: [], blood: [] },
    discards: { sand: [], blood: [] },
    pot: 0,
    round: 0,
    turn: 0,
    currentPlayerIndex: 0,
    pendingDraw: null,
    freeDrawActive: false,
    roundWinnerId: null,
    roundResults: null,
    log: [],
    gameWinnerId: null,
  }
}

const emptyHand = (): Hand => ({
  sand: { id: '', family: 'sand', kind: 'number', value: 0 },
  blood: { id: '', family: 'blood', kind: 'number', value: 0 },
})

/**
 * Rozdá karty pro nové kolo: zamíchá oba balíčky a každému neaktivnímu
 * (nevyřazenému) hráči dá jednu Sand a jednu Blood, resetuje standing
 * a investici kola. Vyřazení hráči zůstávají beze změny.
 *
 * Po rozdání rukou dealer otočí jednu kartu z každého balíčku lícem nahoru na
 * příslušnou odhazovací hromádku (úvodní odhoz Sand a Blood) — bere se z balíčku,
 * žádné karty navíc se nevytvářejí.
 */
function dealRound(players: Player[]): {
  players: Player[]
  decks: { sand: Card[]; blood: Card[] }
  discards: { sand: Card[]; blood: Card[] }
} {
  const sand = shuffle(createDeck('sand'))
  const blood = shuffle(createDeck('blood'))
  const dealt = players.map((p) =>
    p.eliminated
      ? p
      : {
          ...p,
          hand: { sand: sand.pop()!, blood: blood.pop()! },
          standing: false,
          invested: 0,
          playedTokenThisRound: false,
        },
  )
  // Úvodní odhoz: jedna otočená karta z každého balíčku.
  const discards = { sand: [sand.pop()!], blood: [blood.pop()!] }
  return { players: dealt, decks: { sand, blood }, discards }
}

function phaseForPlayer(p: Player): Phase {
  return p.isAi ? 'aiTurn' : 'turn'
}

/** Spustí novou hru podle konfigurace (1 člověk + numAi soupeřů). */
export function startGame(config: GameConfig): GameState {
  const numAi = Math.max(1, Math.min(AI_NAMES.length, config.numAi))
  const players: Player[] = []
  players.push({
    id: 0,
    name: config.humanName.trim() || 'Ty',
    isAi: false,
    hand: emptyHand(),
    standing: false,
    chips: config.startingChips,
    invested: 0,
    eliminated: false,
    tokens: config.humanTokens.slice(0, TOKENS_PER_PLAYER),
    playedTokenThisRound: false,
  })
  for (let i = 0; i < numAi; i++) {
    players.push({
      id: i + 1,
      name: AI_NAMES[i],
      isAi: true,
      hand: emptyHand(),
      standing: false,
      chips: config.startingChips,
      invested: 0,
      eliminated: false,
      tokens: shuffle(ALL_TOKENS).slice(0, TOKENS_PER_PLAYER), // AI losuje náhodně
      playedTokenThisRound: false,
    })
  }

  const { players: dealtPlayers, decks, discards } = dealRound(players)
  return {
    phase: 'turn', // index 0 = člověk
    players: dealtPlayers,
    decks,
    discards,
    pot: 0,
    round: 1,
    turn: 1,
    currentPlayerIndex: 0,
    pendingDraw: null,
    freeDrawActive: false,
    roundWinnerId: null,
    roundResults: null,
    log: [],
    gameWinnerId: null,
  }
}

// ── Tahy ────────────────────────────────────────────────────────────────────

function canAct(p: Player): boolean {
  return !p.eliminated && !p.standing
}

/** Je daný zdroj dostupný k tažení (neprázdný)? */
export function canDrawFrom(state: GameState, source: DrawSource): boolean {
  switch (source) {
    case 'sandDeck':
      return state.decks.sand.length > 0
    case 'bloodDeck':
      return state.decks.blood.length > 0
    case 'sandDiscard':
      return state.discards.sand.length > 0
    case 'bloodDiscard':
      return state.discards.blood.length > 0
  }
}

/** Cena tažení pro aktuální stav (0 při aktivním Free Draw). */
export function drawCost(state: GameState): number {
  return state.freeDrawActive ? 0 : DRAW_COST
}

/** Může aktuální hráč táhnout? (Má na to čipy, nebo má Free Draw.) */
export function canAffordDraw(state: GameState): boolean {
  const p = state.players[state.currentPlayerIndex]
  return !!p && p.chips >= drawCost(state)
}

/**
 * Táhne kartu ze zdroje: zaplatí 1 čip do potu, odebere kartu ze zdroje a
 * uloží ji do pendingDraw. Hand zatím nemění — o ponechané kartě se rozhodne
 * v resolveDraw. Defenzivně: pokud je zdroj prázdný nebo hráč nemá čip, vrací
 * stav beze změny.
 */
export function drawFromSource(state: GameState, source: DrawSource): GameState {
  if (state.phase !== 'turn' && state.phase !== 'aiTurn') return state
  if (state.pendingDraw) return state
  if (!canAffordDraw(state)) return state
  if (!canDrawFrom(state, source)) return state

  const decks = { sand: state.decks.sand.slice(), blood: state.decks.blood.slice() }
  const discards = { sand: state.discards.sand.slice(), blood: state.discards.blood.slice() }
  let drawn: Card
  switch (source) {
    case 'sandDeck':
      drawn = decks.sand.pop()!
      break
    case 'bloodDeck':
      drawn = decks.blood.pop()!
      break
    case 'sandDiscard':
      drawn = discards.sand.pop()!
      break
    case 'bloodDiscard':
      drawn = discards.blood.pop()!
      break
  }

  // Zaplať cenu tažení do potu (0 při Free Draw); Free Draw se spotřebuje.
  const cost = drawCost(state)
  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex
      ? { ...p, chips: p.chips - cost, invested: p.invested + cost }
      : p,
  )

  return {
    ...state,
    decks,
    discards,
    players,
    pot: state.pot + cost,
    pendingDraw: drawn,
    freeDrawActive: false,
  }
}

/**
 * Dokončí tažení: hráč si nechá buď taženou kartu (keepDrawn=true), nebo
 * původní kartu té rodiny (keepDrawn=false). Druhá jde na odhazovací balíček
 * své rodiny. Pak posune hru na dalšího hráče / vyhodnocení.
 */
export function resolveDraw(state: GameState, keepDrawn: boolean): GameState {
  if (state.phase !== 'turn' && state.phase !== 'aiTurn') return state
  if (!state.pendingDraw) return state
  const drawn = state.pendingDraw
  const family = drawn.family
  const player = state.players[state.currentPlayerIndex]
  const existing = player.hand[family]

  const kept = keepDrawn ? drawn : existing
  const discarded = keepDrawn ? existing : drawn

  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: { ...p.hand, [family]: kept } } : p,
  )
  const discards = { sand: state.discards.sand.slice(), blood: state.discards.blood.slice() }
  discards[family].push(discarded)

  return advanceTurn({ ...state, players, discards, pendingDraw: null })
}

/** Hráč zvolí Stát: označí se jako standing a hra postoupí dál. */
export function stand(state: GameState): GameState {
  if (state.phase !== 'turn' && state.phase !== 'aiTurn') return state
  if (state.pendingDraw) return state
  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, standing: true } : p,
  )
  return advanceTurn({ ...state, players })
}

// ── Posun tahu ──────────────────────────────────────────────────────────────

function nextActiveAfter(players: Player[], index: number): number {
  for (let i = index + 1; i < players.length; i++) {
    if (canAct(players[i])) return i
  }
  return -1
}

function firstActive(players: Player[]): number {
  return players.findIndex(canAct)
}

/**
 * Posune hru na dalšího aktivního hráče. Pokud v tomto cyklu už nikdo nezbývá,
 * začne další cyklus; po TURNS_PER_ROUND cyklech (nebo když nikdo nemůže hrát)
 * ukončí kolo a vyhodnotí ho.
 */
function advanceTurn(state: GameState): GameState {
  // Free Draw platí jen pro tah hráče, který ho zahrál — při přechodu zruš.
  state = { ...state, freeDrawActive: false }
  const next = nextActiveAfter(state.players, state.currentPlayerIndex)
  if (next !== -1) {
    return { ...state, currentPlayerIndex: next, phase: phaseForPlayer(state.players[next]) }
  }
  const newTurn = state.turn + 1
  const first = firstActive(state.players)
  if (newTurn > TURNS_PER_ROUND || first === -1) {
    return endRound(state)
  }
  return {
    ...state,
    turn: newTurn,
    currentPlayerIndex: first,
    phase: phaseForPlayer(state.players[first]),
  }
}

/**
 * Ukončí kolo a vyhodnotí čipy. Ruce se nejdřív vyřeší přes resolveHand
 * (Imposter hod kostkou, Sylop vyrovnání, Pure Sabacc). O vítězi rozhoduje
 * skóre síly ruky (handScore) — nejlepší (nejnižší) skóre vyhrává, remíza jen
 * při zcela shodné síle ruky.
 * - vítěz (sólo nejlepší) i remízující dostanou zpět svůj vklad;
 * - ostatní platí penále = max(hodnota ruky, 1), seříznuté na zásobu;
 * - pot se vyprázdní (nevrácené čipy i penále mizí ze hry).
 */
function endRound(state: GameState): GameState {
  const die = () => rollDie()
  const participants = state.players.filter((p) => !p.eliminated)

  // Imposter se hodí jen jednou za kolo — vyřešíme tady a uložíme.
  const resolvedById = new Map<number, ResolvedHand>()
  for (const p of participants) resolvedById.set(p.id, resolveHand(p.hand, die))

  const scoreById = new Map<number, number[]>()
  for (const p of participants) scoreById.set(p.id, handScore(resolvedById.get(p.id)!))

  // Nejlepší (nejnižší) skóre; remíza jen při zcela shodné síle ruky.
  const bestScore = participants
    .map((p) => scoreById.get(p.id)!)
    .reduce((best, s) => (compareHandScore(s, best) < 0 ? s : best))
  const atBest = participants.filter((p) => compareHandScore(scoreById.get(p.id)!, bestScore) === 0)
  const soleWinnerId = atBest.length === 1 ? atBest[0].id : null

  const results: RoundResult[] = []
  const players = state.players.map((p) => {
    if (p.eliminated) return p
    const rh = resolvedById.get(p.id)!
    const isAtBest = compareHandScore(scoreById.get(p.id)!, bestScore) === 0
    let refund = 0
    let penalty = 0
    if (isAtBest) {
      refund = p.invested
    } else {
      penalty = Math.min(rh.value > 0 ? rh.value : 1, p.chips)
    }
    const delta = refund - penalty
    const chipsAfter = p.chips + delta
    const eliminated = chipsAfter <= 0
    results.push({
      playerId: p.id,
      handValue: rh.value,
      resolved: rh,
      invested: p.invested,
      isWinner: isAtBest && soleWinnerId !== null,
      isTie: isAtBest && soleWinnerId === null,
      refund,
      penalty,
      delta,
      chipsAfter,
      eliminated,
    })
    return {
      ...p,
      chips: chipsAfter,
      eliminated,
      eliminatedRound: eliminated ? state.round : p.eliminatedRound,
    }
  })

  return {
    ...state,
    players,
    pot: 0,
    roundWinnerId: soleWinnerId,
    roundResults: results,
    phase: 'reveal',
    pendingDraw: null,
  }
}

// ── Přechody fází z UI ───────────────────────────────────────────────────────

/** Po vyhodnocení: zůstane po vyřazení 1 nebo méně hráčů → konec partie. */
export function willEndGame(state: GameState): boolean {
  return state.players.filter((p) => !p.eliminated).length <= 1
}

/**
 * Jsou všichni zbývající (nevyřazení) hráči AI? Tj. lidský hráč už vypadl a
 * partie se má dohrát automaticky mezi soupeři.
 */
export function onlyAiRemaining(state: GameState): boolean {
  const remaining = state.players.filter((p) => !p.eliminated)
  return remaining.length > 0 && remaining.every((p) => p.isAi)
}

/**
 * Z reveal obrazovky dál: buď rozdá další kolo zbývajícím hráčům, nebo
 * (zbývá ≤ 1 hráč) přejde na konec partie a určí vítěze.
 */
export function nextRound(state: GameState): GameState {
  if (state.phase !== 'reveal') return state
  const remaining = state.players.filter((p) => !p.eliminated)

  if (remaining.length <= 1) {
    // Normálně 1 přeživší; edge case (0 přeživších naráz) → nejlepší ruka kola.
    const gameWinnerId = remaining.length === 1 ? remaining[0].id : state.roundWinnerId
    return { ...state, phase: 'gameover', gameWinnerId }
  }

  const { players, decks, discards } = dealRound(state.players)
  const first = firstActive(players)
  return {
    ...state,
    players,
    decks,
    discards,
    pot: 0,
    round: state.round + 1,
    turn: 1,
    currentPlayerIndex: first,
    pendingDraw: null,
    freeDrawActive: false,
    roundWinnerId: null,
    roundResults: null,
    log: [],
    phase: phaseForPlayer(players[first]),
  }
}
