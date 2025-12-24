/**
 * Login Component - Optimized
 * Handles user authentication and session creation
 */

import { useReducer } from 'react'
import { AlertCircle, Zap } from 'lucide-react'
import type { LoginFormProps, LoginFormState, LoginFormAction, Session } from '@/types/chatflow-types'

const initialState: LoginFormState = { email: 'demo@example.com', isLoading: false, error: null }

function reducer(state: LoginFormState, action: LoginFormAction): LoginFormState {
  switch (action.type) {
    case 'SET_EMAIL': return { ...state, email: action.payload }
    case 'SET_ERROR': return { ...state, error: action.payload }
    case 'SET_LOADING': return { ...state, isLoading: action.payload }
  }
}

const saveSession = (session: Session) => {
  Object.entries(session).forEach(([key, value]) => {
    localStorage.setItem(key, String(value))
  })
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch({ type: 'SET_ERROR', payload: null })
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      const session: Session = {
        sessionId: `session-${Date.now()}`,
        userId: `user-${Date.now()}`,
        email: state.email,
        role: 'user',
        createdAt: Date.now(),
      }
      saveSession(session)
      onLoginSuccess(session)
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Login failed' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-lg border border-slate-200">
        <div className="space-y-4 text-center p-6 border-b border-slate-200">
          <div className="w-14 h-14 rounded-lg bg-slate-900 flex items-center justify-center mx-auto">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">SuperHuman</h1>
            <p className="text-base text-slate-600">Sign in to your account</p>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex gap-3">
              <AlertCircle className="h-4 w-4 text-red-900 shrink-0 mt-0.5" />
              <p className="text-sm text-red-900">{state.error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-900">Email</label>
              <input
                id="email"
                type="email"
                value={state.email}
                onChange={(e) => dispatch({ type: 'SET_EMAIL', payload: e.target.value })}
                placeholder="Enter your email"
                disabled={state.isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={state.isLoading}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-md font-medium hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {state.isLoading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          <p className="pt-4 border-t border-slate-200 text-center text-xs text-slate-600">
            Session will be tracked and remembered across conversations
          </p>
        </div>
      </div>
    </div>
  )
}
