import type { Family, CardKind } from '../lib/sabacc'

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'w-14 h-20 text-2xl rounded-lg',
  md: 'w-20 h-28 text-4xl rounded-xl',
  lg: 'w-24 h-36 text-5xl rounded-xl',
}

const labelClasses: Record<Size, string> = {
  sm: 'text-[8px]',
  md: 'text-[10px]',
  lg: 'text-xs',
}

const specialClasses: Record<Size, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
}

interface FaceProps {
  family: Family
  value: number
  /** Druh karty — speciální se vykreslí jako placeholder s popiskem. */
  kind?: CardKind
  size?: Size
  highlight?: boolean
}

/** Karta lícem nahoru: barevný obdélník s číslem (nebo popiskem speciální karty). */
export function PlayingCard({ family, value, kind = 'number', size = 'md', highlight = false }: FaceProps) {
  const colors =
    family === 'sand'
      ? 'bg-amber-300 text-amber-950 border-amber-500'
      : 'bg-red-600 text-red-50 border-red-800'

  const center =
    kind === 'sylop' ? (
      <span className={`${specialClasses[size]} font-black tracking-tight leading-none`}>⬡</span>
    ) : kind === 'imposter' ? (
      <span className="leading-none">?</span>
    ) : (
      <span className="leading-none">{value}</span>
    )

  return (
    <div
      className={`${sizeClasses[size]} ${colors} relative flex items-center justify-center border-2 font-bold shadow-lg select-none ${
        kind !== 'number' ? 'border-dashed' : ''
      } ${highlight ? 'ring-4 ring-emerald-400' : ''}`}
    >
      <span className={`absolute top-1 left-1.5 font-semibold ${labelClasses[size]} opacity-80`}>
        {family === 'sand' ? 'SAND' : 'BLOOD'}
      </span>
      {center}
      <span className={`absolute bottom-1 right-1.5 font-semibold ${labelClasses[size]} opacity-80`}>
        {kind === 'sylop' ? 'SYLOP' : kind === 'imposter' ? 'IMPOSTER' : family === 'sand' ? 'SAND' : 'BLOOD'}
      </span>
    </div>
  )
}

interface BackProps {
  size?: Size
  /** Vizuálně naznačí, že je balíček prázdný. */
  empty?: boolean
  /** Rodina balíčku — určuje písmeno na rubu (S/B). */
  family?: Family
}

/** Rub karty (balíček lícem dolů). */
export function CardBack({ size = 'md', empty = false, family = 'sand' }: BackProps) {
  if (empty) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center border-2 border-dashed border-slate-600 text-slate-600 text-xs`}
      >
        prázdné
      </div>
    )
  }
  return (
    <div
      className={`${sizeClasses[size]} relative flex items-center justify-center border-2 border-slate-600 bg-slate-800 shadow-lg select-none overflow-hidden`}
    >
      <div
        className="absolute inset-1 rounded-md opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #475569 0 6px, transparent 6px 12px)',
        }}
      />
      <span className="relative text-slate-400 font-black tracking-tighter text-lg">
        {family === 'blood' ? 'B' : 'S'}
      </span>
    </div>
  )
}
