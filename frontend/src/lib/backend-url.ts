const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getBackendOrigin = (): string => {
  const configured = import.meta.env.VITE_BACKEND_URL;
  if (configured) return trimTrailingSlash(configured);

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
  const origin = getBackendOrigin();
  if (!origin) return {};

  try {
    const parsed = new URL(origin);
    return {
      host: parsed.host,
      protocol: parsed.protocol === "https:" ? "wss" : "ws",
    };
  } catch {
    return {};
  }
};
