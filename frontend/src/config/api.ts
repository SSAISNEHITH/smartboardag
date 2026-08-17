// Central API base URL config.
// In development: http://localhost:8080  (from .env)
// In production:  your Railway backend URL (from .env.production)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
export default API_BASE;
