/**
 * Login Component - Multi-Tenant Support
 * Handles user authentication and organization/workspace selection
 */

import { useReducer, useState } from 'react'
import type { LoginFormProps, LoginFormState, LoginFormAction, Session } from '@/types/chatflow-types'

// Demo organizations for testing multi-tenancy
const DEMO_ORGS = [
  { id: 'acme-corp', name: 'Acme Corporation', email: 'admin@acme.com' },
  { id: 'globex-inc', name: 'Globex Inc', email: 'admin@globex.com' },
  { id: 'wayne-enterprises', name: 'Wayne Enterprises', email: 'admin@wayne.com' },
  { id: 'stark-industries', name: 'Stark Industries', email: 'admin@stark.com' },
]

interface ExtendedLoginFormState extends LoginFormState {
  orgId: string
  orgName: string
}

type ExtendedLoginFormAction = LoginFormAction |
  { type: 'SET_ORG'; payload: { id: string; name: string; email: string } }

const initialState: ExtendedLoginFormState = {
  email: 'admin@acme.com',
  isLoading: false,
  error: null,
  orgId: 'acme-corp',
  orgName: 'Acme Corporation'
}

function reducer(state: ExtendedLoginFormState, action: ExtendedLoginFormAction): ExtendedLoginFormState {
  switch (action.type) {
    case 'SET_EMAIL': return { ...state, email: action.payload }
    case 'SET_ERROR': return { ...state, error: action.payload }
    case 'SET_LOADING': return { ...state, isLoading: action.payload }
    case 'SET_ORG': return {
      ...state,
      orgId: action.payload.id,
      orgName: action.payload.name,
      email: action.payload.email
    }
    default: return state
  }
}

const saveSession = (session: Session & { orgId: string; orgName: string }) => {
  Object.entries(session).forEach(([key, value]) => {
    localStorage.setItem(key, String(value))
  })
}

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Starburst icon - multi-pointed star for "superhuman thinking"
function StarburstIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0l2.5 7.5L22 7l-5.5 5L19 19.5 12 15l-7 4.5L7.5 12 2 7l7.5.5L12 0z" />
    </svg>
  )
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [touched, setTouched] = useState(false)
  const [showOrgSelector, setShowOrgSelector] = useState(false)
  const isValid = isValidEmail(state.email)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch({ type: 'SET_ERROR', payload: null })
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      const session = {
        sessionId: state.orgId,
        orgId: state.orgId,
        orgName: state.orgName,
        userId: `user-${state.orgId}-${Date.now()}`,
        email: state.email,
        role: 'admin' as const,
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

  const selectOrg = (org: typeof DEMO_ORGS[0]) => {
    dispatch({ type: 'SET_ORG', payload: { id: org.id, name: org.name, email: org.email } })
    setShowOrgSelector(false)
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200/60">
        {/* Header */}
        <div className="text-center px-6 pt-8 sm:px-8 sm:pt-10 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 flex items-center justify-center mx-auto shadow-lg">
            <StarburstIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-5">SuperHuman</h1>
          <p className="text-sm text-stone-500 mt-1">Sign in to your workspace</p>
        </div>

        {/* Form */}
        <div className="px-6 pb-8 sm:px-8 sm:pb-10">
          {state.error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 flex gap-3">
              <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-medium text-red-700">{state.error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Organization Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-700">
                Organization
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrgSelector(!showOrgSelector)}
                  className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-left flex items-center justify-between hover:border-stone-400 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {state.orgName.charAt(0)}
                    </span>
                    <div>
                      <span className="block text-sm font-semibold text-stone-900">{state.orgName}</span>
                      <span className="block text-xs text-stone-400">{state.email}</span>
                    </div>
                  </span>
                  <svg className={`w-4 h-4 text-stone-400 transition-transform ${showOrgSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showOrgSelector && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                      <p className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">Select workspace</p>
                    </div>
                    {DEMO_ORGS.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => selectOrg(org)}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-stone-50 transition-colors cursor-pointer ${
                          org.id === state.orgId ? 'bg-stone-50' : ''
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          org.id === state.orgId ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {org.name.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900">{org.name}</p>
                          <p className="text-xs text-stone-400">{org.email}</p>
                        </div>
                        {org.id === state.orgId && (
                          <svg className="w-5 h-5 text-stone-900 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                    <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100">
                      <p className="text-[11px] text-stone-400 text-center">
                        Each workspace has isolated data
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">Email address</label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={state.email}
                  onChange={(e) => dispatch({ type: 'SET_EMAIL', payload: e.target.value })}
                  onBlur={() => setTouched(true)}
                  placeholder="you@company.com"
                  disabled={state.isLoading}
                  className={`w-full px-4 py-3 border rounded-xl text-stone-900 placeholder-stone-400 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-stone-50 disabled:cursor-not-allowed ${
                    touched && !isValid
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : touched && isValid
                      ? 'border-stone-900 focus:ring-stone-900 focus:border-stone-900'
                      : 'border-stone-300 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                {touched && isValid && (
                  <svg className="absolute right-3 top-3.5 h-5 w-5 text-stone-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              {touched && !isValid && (
                <p className="text-xs text-red-600 font-medium">Please enter a valid email address</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={state.isLoading || !isValid}
              className="w-full px-4 py-3.5 bg-stone-900 text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:enabled:bg-stone-800 hover:enabled:shadow-lg hover:enabled:-translate-y-px disabled:bg-stone-300 disabled:cursor-not-allowed active:enabled:translate-y-0 cursor-pointer"
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

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-stone-100 text-center">
            <p className="text-[11px] text-stone-400">
              Workspace data is completely isolated per organization
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
