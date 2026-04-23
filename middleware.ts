import createIntlMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './src/i18n/routing'
import { updateSession } from './src/lib/supabase/middleware'

const intlMiddleware = createIntlMiddleware(routing)

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // First, apply next-intl locale routing (handles redirects to locale-prefixed URLs)
  const intlResponse = intlMiddleware(request)

  // Then refresh the Supabase auth session, copying cookies onto the intl response
  return await updateSession(request, intlResponse as NextResponse)
}

export const config = {
  // Match all paths except static files and Next.js internals
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
