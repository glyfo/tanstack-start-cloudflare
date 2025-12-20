/**
 * Login Component
 * Handles user authentication and session creation
 */

import { useState } from 'react'
import { AlertCircle, LogOut } from 'lucide-react'

interface LoginFormProps {
  onLoginSuccess: (session: any) => void
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('demo@example.com')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Demo login - create mock session
      const session = {
        sessionId: `session-${Date.now()}`,
        userId: `user-${Date.now()}`,
        email: email,
        role: 'user',
      }

      localStorage.setItem('sessionId', session.sessionId)
      localStorage.setItem('userId', session.userId)
      localStorage.setItem('userEmail', session.email)
      localStorage.setItem('userRole', session.role)

      onLoginSuccess(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-linear-to-b from-slate-900 to-slate-800 items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">🤖 Multi-Agent CRM</h1>
            <p className="text-slate-400">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-slate-400 text-xs text-center">
              Session will be tracked and remembered across conversations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Session Badge Component
 * Displays current user session info
 */
interface SessionBadgeProps {
  email: string
  role: string
  onLogout: () => void
}

export function SessionBadge({ email, role, onLogout }: SessionBadgeProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      // Clear localStorage
      localStorage.removeItem('sessionId')
      localStorage.removeItem('userId')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userRole')

      onLogout()
    } catch (error) {
      console.error('Logout failed:', error)
      onLogout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-linear-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
          {email[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{email}</p>
          <p className="text-xs text-slate-400 capitalize">{role}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        title="Logout"
      >
        <LogOut className="w-4 h-4 text-slate-400 hover:text-white" />
      </button>
    </div>
  )
}
