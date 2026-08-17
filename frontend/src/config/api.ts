// Central API & WebSocket base URL config.
// Supports localhost development, LAN devices (via QR code / Wi-Fi IP), and Production (Railway/Render).

const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, protocol } = window.location;
    // If user accesses via local network IP (e.g. 192.168.x.x) and envUrl has localhost
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return `${protocol}//${hostname}:8080`;
    }
  }

  return envUrl || 'http://localhost:8080';
};

const getWsBase = (): string => {
  const apiBase = getApiBase();
  if (apiBase.startsWith('https://')) {
    return apiBase.replace('https://', 'wss://');
  }
  return apiBase.replace('http://', 'ws://');
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();
export default API_BASE;
