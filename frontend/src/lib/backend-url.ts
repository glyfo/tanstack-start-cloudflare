const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

// Check if we're in development (localhost)
const isDev = typeof window !== "undefined" && window.location.hostname === "localhost";

// Use localhost in dev, production URL otherwise
const BACKEND_URL = isDev
  ? "http://localhost:8787"
  : "https://tanstack-start-cloudflare-backend.glyfo.workers.dev";

export const getBackendOrigin = (): string => {
  if (BACKEND_URL) return trimTrailingSlash(BACKEND_URL);

  // Fallback to same origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
};

export const buildBackendUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendOrigin()}${normalizedPath}`;
};

export const getBackendSocketConfig = (): {
  host?: string;
  protocol?: "ws" | "wss";
} => {
  // Use localhost in dev, production in prod
  return isDev
    ? {
        host: "localhost:8787",
        protocol: "ws",
      }
    : {
        host: "tanstack-start-cloudflare-backend.glyfo.workers.dev",
        protocol: "wss",
      };
};
