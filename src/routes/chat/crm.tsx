import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/chat/crm')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/chat/crm"!</div>
}
