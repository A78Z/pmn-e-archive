import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard'];
const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Check for session token in cookies
  const sessionToken = req.cookies.get('parse-session-token')?.value;

  if (isProtectedPath(pathname) && !sessionToken) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (sessionToken && pathname === '/login') {
    const target = searchParams.get('redirect');
    const destination =
      target && target.startsWith('/') ? target : '/dashboard';
    const redirectUrl = new URL(destination, req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
