
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Prevent MIME-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Restrict usage of sensitive browser features by default
  response.headers.set('Permissions-Policy', "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()")

  return response
}

// Apply middleware to all paths except for API routes, Next.js static assets, and specific files.
export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api/ (API routes)
    // - _next/static/ (static files)
    // - _next/image/ (image optimization files)
    // - manifest.json (PWA manifest file)
    // - sw.js (service worker file)
    // - icons/ (directory for PWA icons)
    // - favicon.ico (favicon file)
    '/((?!api/|_next/static/|_next/image/|manifest\\.json|sw\\.js|icons/|favicon\\.ico).*)',
  ],
}
