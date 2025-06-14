
// This is the hardcoded default secret key.
// It's crucial that this matches the key used by your backend for signing JWTs.
const DEFAULT_JWT_SECRET_KEY_INTERNAL = "-9$Kc}EbDkafT$)<9k+R0wl[S[m3dL3B~$Cj^Q}cD,HGa+$tO/`zW+HW[%lj2_";

/**
 * Retrieves the JWT secret key.
 * It prioritizes the NEXT_PUBLIC_JWT_SECRET_KEY environment variable
 * and falls back to a hardcoded default if the environment variable is not set or is empty.
 * @returns The JWT secret key as a string.
 * @throws Error if neither the environment variable nor the default key is available (should not happen with a hardcoded default).
 */
export function getJwtSecretKey(): string {
  const envKey = process.env.NEXT_PUBLIC_JWT_SECRET_KEY;

  if (envKey && envKey.trim() !== '') {
    return envKey;
  }
  
  if (DEFAULT_JWT_SECRET_KEY_INTERNAL && DEFAULT_JWT_SECRET_KEY_INTERNAL.trim() !== '') {
    return DEFAULT_JWT_SECRET_KEY_INTERNAL;
  }

  // This case should ideally not be reached if DEFAULT_JWT_SECRET_KEY_INTERNAL is always defined.
  // Log an error and throw to make it obvious if configuration is critically missing.
  console.error("CRITICAL SECURITY ERROR: JWT Secret Key is not configured. Neither NEXT_PUBLIC_JWT_SECRET_KEY environment variable nor a default internal key is available.");
  throw new Error("JWT Secret Key is not configured. Application cannot proceed securely.");
}
