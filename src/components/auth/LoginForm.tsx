/**
 * Login Component - Optimized
 * Handles user authentication and session creation
 */

import { useReducer, useState } from 'react'
import { AlertCircle, Zap, CheckCircle2 } from 'lucide-react'
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

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [touched, setTouched] = useState(false)
  const isValid = isValidEmail(state.email)

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
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="space-y-3 text-center p-8 border-b border-slate-200">
          <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">SuperHuman</h1>
            <p className="text-sm text-slate-600">Sign in to start your conversation</p>
          </div>
        </div>

        <div className="space-y-6 p-8">
          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-3">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-700">{state.error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-900">Email</label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={state.email}
                  onChange={(e) => dispatch({ type: 'SET_EMAIL', payload: e.target.value })}
                  onBlur={() => setTouched(true)}
                  placeholder="Enter your email"
                  disabled={state.isLoading}
                  className={`w-full px-4 py-2.5 border rounded-md text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:cursor-not-allowed ${
                    touched && !isValid
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : touched && isValid
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-slate-300 focus:ring-slate-900 focus:border-slate-900'
                  }`}
                />
                {touched && isValid && (
                  <CheckCircle2 className="absolute right-3 top-2.5 h-5 w-5 text-green-600" />
                )}
              </div>
              {touched && !isValid && (
                <p className="text-xs text-red-600 font-medium">Please enter a valid email address</p>
              )}
            </div>

            <button
              type="submit"
              disabled={state.isLoading || !isValid}
              className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-md font-semibold transition-all duration-200 hover:enabled:bg-slate-800 hover:enabled:shadow-md hover:enabled:translate-y-[-1px] disabled:bg-slate-400 disabled:cursor-not-allowed active:enabled:translate-y-[0px]"
            >
              {state.isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-center text-xs text-slate-500">
              Your conversations are automatically saved
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
