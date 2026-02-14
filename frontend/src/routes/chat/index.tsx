import { createFileRoute } from '@tanstack/react-router'
import { ModernChatEngine } from '@/components/chat/ChatEngine'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/chat/')({
  component: ChatPage,
})

function ChatPage() {
  // Persist session ID in localStorage to reuse the same Durable Object
  const [sessionId, setSessionId] = useState<string>('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // Mark that we're now on the client
    setIsClient(true)
    
    // Check if we have an existing session
    let existingSession = localStorage.getItem('chat-session-id')
    
    if (!existingSession) {
      // Create new session and persist it
      existingSession = crypto.randomUUID()
      localStorage.setItem('chat-session-id', existingSession)
    }
    
    console.log('[Chat] Session ID initialized:', existingSession.substring(0, 8))
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
