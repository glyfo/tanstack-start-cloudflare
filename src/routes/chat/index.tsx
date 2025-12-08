import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '../../components/Chat'

export const Route = createFileRoute('/chat/')({
  component: ChatPage,
})

function ChatPage() {
  const search = Route.useSearch()

  return <Chat email={search.email || ''} />
}
