// API Configuration
// Development: localhost:3002
// Production: same host as frontend, port 3002

const isDevelopment = import.meta.env.DEV;

// In production, use the same hostname as the frontend but with API port
const getApiBase = (): string => {
  if (isDevelopment) {
    return 'http://localhost:3002';
  }

  // Production: use the current hostname with API port
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3002`;
};

export const API_BASE = getApiBase();

// Export for debugging
export const CONFIG = {
  isDevelopment,
  apiBase: API_BASE,
};
