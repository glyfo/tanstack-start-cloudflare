import { createFileRoute } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/chat')({
  component: ChatLayoutRoute,
})

function ChatLayoutRoute() {
  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Content */}
      <div className="flex-1 bg-white">
        <Outlet />
      </div>
    </div>
  )
}
