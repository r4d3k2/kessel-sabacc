import { useState } from 'react'
import { Coins } from 'lucide-react'
import {
  AI_OPTIONS,
  CHIP_OPTIONS,
  DEFAULT_CHIPS,
  ALL_TOKENS,
  TOKENS_PER_PLAYER,
  type GameConfig,
  type TokenId,
} from '../lib/sabacc'
import { TOKEN_DEFS } from '../lib/tokens'

interface Props {
  onStart: (config: GameConfig) => void
}

export function SetupScreen({ onStart }: Props) {
  const [humanName, setHumanName] = useState('Ty')
  const [numAi, setNumAi] = useState(2)
  const [startingChips, setStartingChips] = useState<number>(DEFAULT_CHIPS)
  const [tokens, setTokens] = useState<TokenId[]>([])

  const toggleToken = (t: TokenId) => {
    setTokens((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t)
        : prev.length < TOKENS_PER_PLAYER
          ? [...prev, t]
          : prev,
    )
  }
  const tokensReady = tokens.length === TOKENS_PER_PLAYER

  return (
    <div className="flex flex-col items-center gap-8 px-5 py-10 max-w-md mx-auto">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-amber-300">Kessel Sabacc</h1>
        <p className="mt-2 text-sm text-slate-400">Ty proti AI soupeřům · čipová ekonomika</p>
      </header>

      <section className="w-full">
        <label className="block text-sm font-medium text-slate-300 mb-2">Tvoje jméno</label>
        <input
          value={humanName}
          onChange={(e) => setHumanName(e.target.value)}
          maxLength={20}
          className="w-full h-11 px-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 focus:border-[#2fd4c4] focus:outline-none"
          placeholder="Ty"
        />
      </section>

      <section className="w-full">
        <label className="block text-sm font-medium text-slate-300 mb-2">Počet AI soupeřů</label>
        <div className="grid grid-cols-3 gap-2">
          {AI_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setNumAi(n)}
              className={`h-12 rounded-xl font-bold text-lg transition-colors ${
                numAi === n ? 'bg-[#13a394] text-[#eafffb]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="w-full">
        <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
          <Coins size={16} /> Startovní čipy
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CHIP_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setStartingChips(n)}
              className={`h-12 rounded-xl font-bold text-lg transition-colors ${
                startingChips === n ? 'bg-[#13a394] text-[#eafffb]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="w-full">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Vyber 3 Shift Tokeny ({tokens.length}/{TOKENS_PER_PLAYER})
        </label>
        <div className="flex flex-col gap-2">
          {ALL_TOKENS.map((t) => {
            const selected = tokens.includes(t)
            const full = !selected && tokens.length >= TOKENS_PER_PLAYER
            return (
              <button
                key={t}
                onClick={() => toggleToken(t)}
                disabled={full}
                className={`text-left rounded-xl px-3 py-2 border transition-colors ${
                  selected
                    ? 'bg-[#13a394] text-[#eafffb] border-[#2fd4c4]'
                    : full
                      ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span className="font-bold">{TOKEN_DEFS[t].name}</span>
                <span className={`block text-xs ${selected ? 'text-[#d4fff8]' : 'text-slate-400'}`}>
                  {TOKEN_DEFS[t].desc}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <button
        onClick={() => onStart({ humanName, numAi, startingChips, humanTokens: tokens })}
        disabled={!tokensReady}
        className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {tokensReady ? 'Začít hru' : `Vyber ještě ${TOKENS_PER_PLAYER - tokens.length} token(y)`}
      </button>
    </div>
  )
}
