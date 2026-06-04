import { useReducer, useEffect } from 'react'
import {
  createInitialState,
  startGame,
  drawFromSource,
  resolveDraw,
  stand,
  nextRound,
  onlyAiRemaining,
  type GameState,
  type GameConfig,
  type DrawSource,
} from './lib/sabacc'
import { applyAiTurn } from './lib/ai'
import { SetupScreen } from './components/SetupScreen'
import { TurnScreen } from './components/TurnScreen'
import { AiTurnScreen } from './components/AiTurnScreen'
import { RevealScreen } from './components/RevealScreen'
import { GameOverScreen } from './components/GameOverScreen'

type Action =
  | { type: 'START_GAME'; config: GameConfig }
  | { type: 'DRAW_FROM_SOURCE'; source: DrawSource }
  | { type: 'RESOLVE_DRAW'; keepDrawn: boolean }
  | { type: 'STAND' }
  | { type: 'AI_MOVE' }
  | { type: 'NEXT_ROUND' }
  | { type: 'NEW_GAME' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(action.config)
    case 'DRAW_FROM_SOURCE':
      return drawFromSource(state, action.source)
    case 'RESOLVE_DRAW':
      return resolveDraw(state, action.keepDrawn)
    case 'STAND':
      return stand(state)
    case 'AI_MOVE':
      return applyAiTurn(state)
    case 'NEXT_ROUND':
      return nextRound(state)
    case 'NEW_GAME':
      return createInitialState()
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)

  // Když je na tahu AI, po krátké prodlevě automaticky odehraj jeho tah.
  useEffect(() => {
    if (state.phase !== 'aiTurn') return
    const delay = 600 + Math.random() * 300
    const id = setTimeout(() => dispatch({ type: 'AI_MOVE' }), delay)
    return () => clearTimeout(id)
  }, [state.phase, state.currentPlayerIndex, state.turn, state.round])

  // Když už u stolu zůstávají jen AI (člověk vypadl), proklikávej reveal sám —
  // krátká pauza, ať je výsledek kola vidět, pak další kolo. Gameover čeká.
  const autoPlaying = onlyAiRemaining(state)
  useEffect(() => {
    if (state.phase !== 'reveal' || !autoPlaying) return
    const id = setTimeout(() => dispatch({ type: 'NEXT_ROUND' }), 1300)
    return () => clearTimeout(id)
  }, [state.phase, state.round, autoPlaying])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f3d2e_0%,_#0a1f1a_45%,_#020617_100%)]">
        {state.phase === 'setup' && (
          <SetupScreen onStart={(config) => dispatch({ type: 'START_GAME', config })} />
        )}

        {state.phase === 'turn' && (
          <TurnScreen
            state={state}
            onDrawFromSource={(source) => dispatch({ type: 'DRAW_FROM_SOURCE', source })}
            onResolveDraw={(keepDrawn) => dispatch({ type: 'RESOLVE_DRAW', keepDrawn })}
            onStand={() => dispatch({ type: 'STAND' })}
          />
        )}

        {state.phase === 'aiTurn' && <AiTurnScreen state={state} autoPlaying={autoPlaying} />}

        {state.phase === 'reveal' && (
          <RevealScreen
            state={state}
            autoAdvancing={autoPlaying}
            onNext={() => dispatch({ type: 'NEXT_ROUND' })}
          />
        )}

        {state.phase === 'gameover' && (
          <GameOverScreen state={state} onNewGame={() => dispatch({ type: 'NEW_GAME' })} />
        )}
      </div>
    </div>
  )
}
