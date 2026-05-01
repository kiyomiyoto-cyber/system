import createIntlMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'

const intlMiddleware = createIntlMiddleware(routing)

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const intlResponse = intlMiddleware(request)
  return await updateSession(request, intlResponse as NextResponse)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
