
export const APP_NAME = 'À faire';

// HARDCODED_APP_PIN is null, meaning PIN lock relies on user-set PIN or is disabled.
export const HARDCODED_APP_PIN: string | null = null;
    
// Default API Base URL. Can be overridden by NEXT_PUBLIC_API_BASE_URL environment variable.
// Make sure this matches your backend deployment, including any /api prefix if applicable.
export const DEFAULT_API_BASE_URL = "https://afaire.is-cool.dev/api";

// DEFAULT_JWT_SECRET_KEY is removed as the frontend does not verify JWT signatures.
// The backend handles JWT verification.
    
    