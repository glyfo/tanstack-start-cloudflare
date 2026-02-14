/**
 * Frontend Cloudflare Worker Entry
 * Serves TanStack Start SSR only.
 */

let tanstackHandler: any;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (!tanstackHandler) {
      const mod = await import("@tanstack/react-start/server-entry");
      tanstackHandler = mod.default;
    }

    return tanstackHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler;
