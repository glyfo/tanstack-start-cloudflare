import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/chat')({
  component: ChatLayoutRoute,
})

function ChatLayoutRoute() {
  return (
    <div className="h-screen bg-white flex flex-col">
      <Outlet />
    </div>
  )
}
