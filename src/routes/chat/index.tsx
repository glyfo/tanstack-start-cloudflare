import { createFileRoute } from '@tanstack/react-router'
import { ChatEngine } from '@/components/chat/ChatEngine'

export const Route = createFileRoute('/chat/')({
  component: ChatPage,
})

function ChatPage() {
  const sessionId = crypto.randomUUID()

  return <ChatEngine sessionId={sessionId} />
}
