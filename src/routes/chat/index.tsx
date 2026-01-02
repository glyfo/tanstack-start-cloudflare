import { createFileRoute } from '@tanstack/react-router'
import { ModernChatEngine } from '@/components/chat/ChatEngine'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/chat/')({
  component: ChatPage,
})

function ChatPage() {
  // Persist session ID in localStorage to reuse the same Durable Object
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    // Check if we have an existing session
    let existingSession = localStorage.getItem('chat-session-id')
    
    if (!existingSession) {
      // Create new session and persist it
      existingSession = crypto.randomUUID()
      localStorage.setItem('chat-session-id', existingSession)
    }
    
    setSessionId(existingSession)
  }, [])

  // Don't render until we have a session ID
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    )
  }

  return <ModernChatEngine sessionId={sessionId} />
}
