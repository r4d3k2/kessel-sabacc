import { useState } from 'react'
import { Coins } from 'lucide-react'
import { AI_OPTIONS, CHIP_OPTIONS, DEFAULT_CHIPS, type GameConfig } from '../lib/sabacc'

interface Props {
  onStart: (config: GameConfig) => void
}

export function SetupScreen({ onStart }: Props) {
  const [humanName, setHumanName] = useState('Ty')
  const [numAi, setNumAi] = useState(2)
  const [startingChips, setStartingChips] = useState<number>(DEFAULT_CHIPS)

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

      <button
        onClick={() => onStart({ humanName, numAi, startingChips })}
        className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-lg transition-colors"
      >
        Začít hru
      </button>
    </div>
  )
}
