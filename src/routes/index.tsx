import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { MessageSquare, ArrowRight, Zap, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/shadcn/button'
import { Input } from '@/components/ui/shadcn/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadcn/card'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleLaunchChat = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateEmail(email)) {
      alert('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    // Simulate validation
    setTimeout(() => {
      setIsLoading(false)
      // Navigate to chat route with email
      navigate({ to: '/chat', search: { email } })
    }, 800)
  }

  // Light Theme Landing Page - Centered Layout
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Section - Login Card - Centered */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md shadow-lg">
              <CardHeader className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-bold">SuperHuman</CardTitle>
                  <CardDescription className="text-base">Sign in to your account</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleLaunchChat} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-slate-900">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !validateEmail(email)}
                    className="w-full"
                  >
                    {isLoading ? (
                      'Launching...'
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Access Console
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-600 space-y-1">
                  <p>
                    By accessing, you agree to our{' '}
                    <a href="#" className="text-slate-900 hover:underline font-medium">
                      Terms
                    </a>
                    {' '}and{' '}
                    <a href="#" className="text-slate-900 hover:underline font-medium">
                      Privacy
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Section - Features - Centered */}
          <div className="flex justify-center lg:justify-start">
            <div className="space-y-8 w-full max-w-md">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                  <Zap className="w-4 h-4 text-slate-900" />
                  <span className="text-sm font-medium text-slate-900">Powered by AI</span>
                </div>

                <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                  Feel like a SuperHuman
                </h1>

                <p className="text-lg text-slate-600 leading-relaxed">
                  Experience the future of productivity with elegance, grace, and revolutionary AI-powered sophistication.
                </p>
              </div>

              {/* Social Proof */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400 text-lg">•</span>
                  <span className="text-sm font-medium">Join 10,000+ professionals</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400 text-lg">•</span>
                  <span className="text-sm font-medium">Trusted by leading global companies</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-slate-900 font-medium">Intelligent automation</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-slate-900 font-medium">Seamless collaboration</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-slate-900 font-medium">Premium security</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}