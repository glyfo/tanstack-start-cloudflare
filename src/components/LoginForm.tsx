/**
 * Login Component
 * Handles user authentication and session creation
 */

import { useState } from 'react'
import { AlertCircle, LogOut, Zap } from 'lucide-react'
import { Button } from '@/components/ui/shadcn/button'
import { Input } from '@/components/ui/shadcn/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadcn/card'
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert'

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
    <div className="flex h-screen bg-white items-center justify-center">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-lg bg-slate-900 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl">SuperHuman</CardTitle>
              <CardDescription className="text-base">Sign in to your account</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-slate-900">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Logging in...' : 'Sign In'}
              </Button>
            </form>

            {/* Additional Info */}
            <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-600">
              <p>
                Session will be tracked and remembered across conversations
              </p>
            </div>
          </CardContent>
        </Card>
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
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
          {email[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">{email}</p>
          <p className="text-xs text-slate-600 capitalize">{role}</p>
        </div>
      </div>

      <Button
        onClick={handleLogout}
        disabled={isLoggingOut}
        variant="ghost"
        size="icon"
        title="Logout"
      >
        <LogOut className="w-4 h-4 text-slate-600" />
      </Button>
    </div>
  )
}
