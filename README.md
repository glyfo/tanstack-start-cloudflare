# TanStack Start + Cloudflare Workers AI Chat Application

A production-ready chat application built with **TanStack React Start** and **Cloudflare Workers AI**, featuring real-time streaming responses, modern UI/UX, and comprehensive error handling.

## 🚀 Features

### Core Features
- **Real-time Streaming Chat**: Uses Server-Sent Events (SSE) for progressive token streaming
- **Cloudflare Workers AI Integration**: Direct integration with `@cf/meta/llama-3.1-8b-instruct` model
- **Type-Safe Server Functions**: TanStack React Start server functions with TypeScript validation
- **Production-Ready**: Optimized for performance, accessibility, and error recovery

### UI/UX Enhancements (Priority 1 & 2)
- **Error Banner**: User-friendly error display with retry capability
- **Copy Message Button**: Copy assistant responses with visual feedback (green checkmark)
- **Message Timestamps**: Every message displays time in HH:MM format
- **Clear Chat Button**: Clear conversation history with confirmation dialog
- **Regenerate/Retry Button**: Resend the last user message to get a new response
- **Loading Indicators**: Smooth typing animation during response generation
- **Auto-Scroll**: Automatically scrolls to the latest message
- **Empty State**: "Start a conversation" message when no messages exist
- **Settings Sidebar**: Collapsible preferences and account info panel
- **Suggestion Tips**: Quick-access EXPLORE SUGGESTIONS that auto-send when clicked and collapse after sending
- **Markdown Support**: Basic markdown parsing for bold text (`**text**` → `<strong>text</strong>`)
- **Mobile Responsive**: Fully responsive design with Tailwind CSS

### Architecture Decisions
- ✅ **Direct Cloudflare Bindings**: Uses `env` import from `cloudflare:workers`
- ✅ **Custom Streaming Implementation**: Opted against `@tanstack/ai` (no Cloudflare Workers adapter available)
- ✅ **Component-Based State**: Clean React hooks for state management
- ✅ **Proper Error Recovery**: Automatic error display with retry mechanisms

## 📋 Tech Stack

### Frontend
- **Framework**: TanStack React Start (React 18+)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Type Safety**: TypeScript

### Backend
- **Server Functions**: TanStack React Start `createServerFn()`
- **Cloud Provider**: Cloudflare Workers
- **AI Model**: `@cf/meta/llama-3.1-8b-instruct` (Llama 3.1 8B)
- **Streaming Protocol**: Server-Sent Events (SSE)

### Build & Deploy
- **Build Tool**: Vite
- **Deploy Platform**: Cloudflare (via Wrangler)
- **Package Manager**: npm/yarn

## 🏗️ Project Structure

```
src/
├── server/
│   └── ai.ts                    # Consolidated AI server function
├── components/
│   ├── Chat.tsx                 # Main chat interface (all logic)
│   ├── ChatMessages.tsx         # Message list container
│   ├── MessageBubble.tsx        # Individual message with copy/timestamps
│   ├── ChatInput.tsx            # Input form component
│   ├── TypingIndicator.tsx      # Loading animation
│   └── [other components]
├── routes/
│   ├── __root.tsx               # Root layout with notFoundComponent
│   ├── index.tsx                # Home page
│   ├── chat.tsx                 # Chat route
│   └── demo/                    # Demo/example routes
├── router.tsx                   # TanStack Router configuration
├── routeTree.gen.ts             # Auto-generated route tree
└── styles.css                   # Global styles
```

## 🔧 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Cloudflare Workers account
- Cloudflare API token with AI permissions

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tanstack-start-cloudflare

# Install dependencies
npm install

# Set up environment variables
# Create a .env file with:
# CLOUDFLARE_ACCOUNT_ID=your_account_id
# CLOUDFLARE_API_TOKEN=your_api_token
```

### Development

```bash
# Start development server
npm run dev

# Navigate to http://localhost:5173/chat
# Send a message and watch it stream in real-time
```

### Building

```bash
# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## 📝 API Reference

### Server Function: `connectToAI`

**Purpose**: Connects to Cloudflare Workers AI and streams responses

**Input**:
```typescript
interface AIInput {
  prompt: string
}
```

**Usage**:
```typescript
import { connectToAI } from '@/server/ai'

const response = await connectToAI.fetch({ prompt: 'Your message here' })
```

**Response Format**: Server-Sent Events (SSE)
```
data: {"token":"Hello","done":false}

data: {"token":" ","done":false}

data: {"token":"world","done":false}

data: [DONE]
```

**Error Handling**:
```typescript
try {
  const response = await connectToAI.fetch({ prompt })
  // Process streaming response
} catch (error) {
  console.error('AI Error:', error)
  setError('Failed to get response. Please try again.')
}
```

## 🎯 Component Overview

### Chat.tsx (Main Component)
**Responsibilities**:
- State management (messages, loading, error, input)
- Message sending and streaming
- User interactions (copy, clear, regenerate)
- Suggestion handling
- Settings management

**Key Functions**:
- `sendMessage(content)` - Core streaming logic
- `copyToClipboard(text, messageId)` - Copy with visual feedback
- `handleClearChat()` - Clear with confirmation
- `handleRegenerateMessage()` - Retry last message
- `handleTipClick(example)` - Auto-send suggestion

### ChatMessages.tsx
- Displays message list with empty state
- Passes copy handler to individual messages
- Tracks which message was copied for visual feedback

### MessageBubble.tsx
- Renders individual messages (user or assistant)
- Copy button (hover-activated for assistant only)
- Timestamps on all messages
- Markdown bold text parsing (`**text**` → `<strong>text</strong>`)
- Different styling for user vs assistant messages

### ChatInput.tsx
- Form input with textarea
- Keyboard handling (Enter to send, Shift+Enter for newline)
- Submit handler

## 🔌 Cloudflare Workers AI Integration

### How It Works

1. **User Sends Message**: Message submitted to `connectToAI` server function
2. **Server Function**: Receives prompt, accesses Cloudflare AI binding
3. **AI Model**: `@cf/meta/llama-3.1-8b-instruct` generates response
4. **Streaming**: Response returned as Server-Sent Events (SSE)
5. **Client Parsing**: Frontend parses SSE stream token by token
6. **Progressive Display**: Tokens accumulated and displayed incrementally

### Configuration

The AI server function is configured in `/src/server/ai.ts`:

```typescript
const AI = (env as any).AI;
const model = "@cf/meta/llama-3.1-8b-instruct";
const response = await AI.run(model, { 
  prompt: userMessage,
  stream: true  // Enable streaming
});
```

### Bindings Setup (wrangler.jsonc)

```json
{
  "env": {
    "production": {
      "bindings": [
        {
          "binding": "AI",
          "type": "ai"
        }
      ]
    }
  }
}
```

## 🎨 UI/UX Features in Detail

### Error Handling
- **Error Banner**: Red banner with error message
- **Retry Button**: Automatically resends last message
- **Dismiss Option**: Close error banner manually
- **State Persistence**: Error state maintained until dismissed

### Message Management
- **Copy Button**: Appears on hover for assistant messages
- **Visual Feedback**: Green checkmark for 2 seconds after copy
- **Timestamps**: Shows message time (HH:MM format)
- **Clear Chat**: Delete all messages with confirmation dialog
- **Regenerate**: Resend last user message for new response

### Loading States
- **Typing Indicator**: Shows while waiting for response
- **Disabled Input**: Prevents sending while loading
- **Disabled Buttons**: Clear/Retry buttons disabled during loading

### Suggestions
- **Quick Access**: "EXPLORE SUGGESTIONS" with categories
- **Auto-Send**: Click suggestion to auto-send message
- **Auto-Collapse**: Tips collapse after sending
- **Categories**: Revenue, Performance, Priorities, Updates

## 🚨 Error Recovery

The application handles various error scenarios:

```typescript
// Missing prompt
if (!prompt) {
  prompt = "Tell me something interesting"
}

// API errors
try {
  const response = await connectToAI.fetch({ prompt })
} catch (err) {
  setError('Failed to get response. Please try again.')
  setMessages((prev) => prev.slice(0, -1)) // Remove incomplete message
}

// Stream parsing errors
try {
  const chunk = JSON.parse(data)
  // Process chunk
} catch (parseErr) {
  console.error('Parse error:', parseErr)
}
```

## 📊 Performance Optimizations

- **Token Batching**: Updates don't occur on every single token
- **Efficient Re-renders**: Only relevant state updates trigger renders
- **Ref-Based Accumulation**: Uses refs for non-visual state (accumulated tokens)
- **Auto-Scroll**: Smooth scrolling to latest message using IntersectionObserver
- **Mobile Optimization**: Hidden button text on mobile, icons only

## ♿ Accessibility

- **Semantic HTML**: Proper HTML structure for screen readers
- **ARIA Labels**: Buttons have appropriate labels
- **Color Contrast**: WCAG AA compliant colors
- **Keyboard Navigation**: Tabs/Enter keys work correctly
- **Timestamps**: Context for when messages were sent
- **Error Messages**: Clear, descriptive error text

## 🧪 Testing Checklist

Before deployment, verify:

- [ ] Build succeeds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] Chat page loads correctly
- [ ] Can type and send messages
- [ ] Streaming starts immediately
- [ ] Text appears progressively (token by token)
- [ ] Error message displays on failure
- [ ] Retry button works
- [ ] Copy button works and shows feedback
- [ ] Clear chat works with confirmation
- [ ] Regenerate button resends last message
- [ ] Auto-scroll follows latest message
- [ ] Timestamps display correctly
- [ ] Suggestions auto-send and collapse
- [ ] Settings panel toggles open/close
- [ ] Mobile responsive layout works

## 🐛 Debugging Tips

### No streaming visible?
```typescript
// Add console logs in Chat.tsx sendMessage()
const chunk = JSON.parse(data)
console.log("Chunk received:", chunk)
```

### Errors in console?
- Verify Cloudflare credentials in `.env`
- Check API token has AI permissions
- Verify account ID is correct
- Check Cloudflare dashboard status

### Messages not displaying?
- Check browser DevTools Network tab
- Verify SSE response headers
- Ensure response is `Content-Type: text/event-stream`
- Check for CORS issues (shouldn't occur with Cloudflare)

### Building fails?
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf .turbo dist`
- Check TypeScript errors: `npx tsc --noEmit`

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `/src/server/ai.ts` | Cloudflare Workers AI integration |
| `/src/components/Chat.tsx` | Main chat component with all logic |
| `/src/components/MessageBubble.tsx` | Message rendering with copy/timestamps |
| `/src/routes/chat.tsx` | Chat page route |
| `/wrangler.jsonc` | Cloudflare Workers configuration |
| `/tsconfig.json` | TypeScript configuration |
| `/vite.config.ts` | Vite build configuration |

## 🔐 Security Considerations

- **No Credentials in Code**: Uses Cloudflare bindings instead of API tokens
- **Server-Side Only**: AI calls made only on server, not exposed to client
- **Input Validation**: Typed `AIInput` interface validates prompts
- **Error Messages**: Don't expose sensitive error details to users
- **CORS**: Cloudflare Workers handle CORS automatically

## 🚀 Deployment

### Deploy to Cloudflare Workers

```bash
# Ensure credentials are set
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token

# Deploy
npm run deploy
```

### Production Checklist
- [ ] Environment variables configured
- [ ] AI binding added to wrangler.jsonc
- [ ] API token has necessary permissions
- [ ] Build succeeds without errors
- [ ] All tests pass
- [ ] Error handling verified
- [ ] Performance tested under load

## 📖 Architecture Decisions

### Why Custom Streaming Over `@tanstack/ai`?
- **No Adapter**: `@tanstack/ai` v0.0.40 has no Cloudflare Workers AI adapter
- **Simplicity**: Custom SSE implementation is straightforward and proven
- **Control**: Direct control over streaming and error handling
- **Size**: Avoids additional dependency overhead

### Why Direct Cloudflare Bindings?
- **Security**: No credentials in environment variables
- **Performance**: Direct access without additional auth layers
- **Simplicity**: Native Cloudflare workers pattern

### Why Component State Over Redux/Zustand?
- **Project Size**: State is localized to Chat component
- **Simplicity**: Built-in React hooks sufficient for requirements
- **Bundle Size**: Avoids additional dependencies

## 🤝 Contributing

To contribute to this project:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Troubleshooting

### Common Issues

**Issue**: "Cannot find module 'cloudflare:workers'"
- **Solution**: Ensure running on Cloudflare Workers environment or mock in dev

**Issue**: Messages not streaming
- **Solution**: Check browser DevTools → Network tab for SSE response

**Issue**: Build fails with TypeScript errors
- **Solution**: Run `npx tsc --noEmit` to see all errors

**Issue**: Cloudflare API returns 401 Unauthorized
- **Solution**: Verify API token and account ID in environment variables

## 📞 Support

For issues, questions, or suggestions:
1. Check this README and troubleshooting section
2. Review code comments in `/src/server/ai.ts`
3. Check browser console for error messages
4. Verify Cloudflare dashboard for service status

## 🎉 Getting Help

- **DevTools**: Use browser DevTools to inspect network requests
- **Console Logs**: Add logs to debug streaming and state updates
- **Cloudflare Dashboard**: Monitor API usage and logs
- **Documentation**: See comments in source code

---

**Last Updated**: December 10, 2025  
**Version**: 1.0.0 (Production Ready)  
**Status**: ✅ All Priority 1 & 2 features implemented and tested

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Routing

This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
npm install @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
