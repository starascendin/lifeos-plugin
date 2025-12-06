import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/signin(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
]);

const isSignInPage = createRouteMatcher(["/signin(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // Redirect authenticated users away from signin/signup pages
  if (userId && isSignInPage(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect non-public routes
  if (!userId && !isPublicRoute(request)) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
