import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LoginForm } from '@/components/auth/LoginForm'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const navigate = useNavigate()

  const handleLoginSuccess = (session: any) => {
    navigate({ to: '/chat', search: { email: session.email } })
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">ChatFlow Agent</h1>
            <p className="text-slate-600">AI-powered conversation engine</p>
          </div>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    </div>
  )
}