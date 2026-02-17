import { createFileRoute } from '@tanstack/react-router'
import { ModernChatEngine } from '@/components/chat/ChatEngine'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/chat/')({
  component: ChatPage,
  // Skip SSR for this route - chat requires browser APIs
  ssr: false,
})

function ChatPage() {
  // Persist session ID in localStorage to reuse the same Durable Object
  const [sessionId, setSessionId] = useState<string>('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // Mark that we're now on the client
    setIsClient(true)

    // Check for user/org changes (new login)
    const currentUser = localStorage.getItem('current-user-id')
    const currentOrg = localStorage.getItem('current-org-id')
    const lastUser = localStorage.getItem('last-user-id')
    const lastOrg = localStorage.getItem('last-org-id')

    // Detect login change
    const userChanged = currentUser && lastUser && currentUser !== lastUser
    const orgChanged = currentOrg && lastOrg && currentOrg !== lastOrg

    if (userChanged || orgChanged) {
      console.log('[Chat] User/Org changed - clearing session')
      localStorage.removeItem('chat-session-id')
    }

    // Update last user/org
    if (currentUser) localStorage.setItem('last-user-id', currentUser)
    if (currentOrg) localStorage.setItem('last-org-id', currentOrg)

    // Check if we have an existing session
    let existingSession = localStorage.getItem('chat-session-id')

    if (!existingSession) {
      // Create new session and persist it
      existingSession = crypto.randomUUID()
      localStorage.setItem('chat-session-id', existingSession)
      console.log('[Chat] New session created:', existingSession.substring(0, 8))
    } else {
      console.log('[Chat] Existing session resumed:', existingSession.substring(0, 8))
    }

    setSessionId(existingSession)
  }, [])

  // Don't render until we're on the client and have a session ID
  if (!isClient || !sessionId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    )
  }

  return <ModernChatEngine sessionId={sessionId} />
}
