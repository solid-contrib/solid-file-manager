"use client";

import { useEffect, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import LoadingSpinner from "./shared/LoadingSpinner";

interface AuthWrapperProps {
  children: React.ReactNode;
}

// Check if there's any indication of a session in storage
function hasSessionInStorage(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const keys = Object.keys(localStorage);
    // Look for keys that might indicate a session exists
    return keys.some(key => 
      key.includes("solidClientAuthn") || 
      key.includes("solid-auth") ||
      key.includes("oidc") ||
      key.includes("session")
    );
  } catch {
    return false;
  }
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { session } = useSolidAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSessionIndicator, setHasSessionIndicator] = useState(() => hasSessionInStorage());
  const [wasLoggedIn, setWasLoggedIn] = useState(false);

  // Check if we're in the middle of an OAuth callback
  const isOAuthCallback = searchParams.has("code") || searchParams.has("state");
  const isLoginPage = pathname === "/login";

 
  const hasSessionData = !!(session.webId || session.sessionId || session.clientAppId);

  useEffect(() => {
    if (session.isLoggedIn) {
      setWasLoggedIn(true);
    }

    // If we're in an OAuth callback, keep checking until session is established
    // Don't redirect until session is confirmed
    if (isOAuthCallback) {
      setIsCheckingSession(true);
      
      if (session.isLoggedIn) {
        setIsCheckingSession(false);
        // Redirect to home after successful OAuth (remove OAuth params from URL)
        const redirectTimer = setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }, 200);
        return () => clearTimeout(redirectTimer);
      } else {
        // Session not yet established, keep waiting
        // Set a timeout to prevent infinite waiting (max 10 seconds)
        const maxWaitTimer = setTimeout(() => {
          setIsCheckingSession(false);
        }, 10000);
        return () => clearTimeout(maxWaitTimer);
      }
    }

   
    if (session.isLoggedIn) {
      setIsCheckingSession(false);
      if (isLoginPage) {
        router.replace("/");
      }
      return;
    }

  
    if (wasLoggedIn && !session.isLoggedIn) {
      setIsCheckingSession(false);
      if (!isLoginPage) {
        router.replace("/login");
      }
      return;
    }

    // If we have session data (webId, sessionId, etc.) but isLoggedIn is false,
    // the session is likely being restored - wait longer
    // Otherwise, if no session data and no storage indicator, show login quickly
    const shouldWaitForRestore = hasSessionData || hasSessionIndicator;
    const checkTimer = setTimeout(() => {
      setIsCheckingSession(false);

      if (!session.isLoggedIn && !isLoginPage && !isOAuthCallback) {
        router.replace("/login");
      }
    }, shouldWaitForRestore ? 2000 : 200);

    return () => clearTimeout(checkTimer);
  }, [session.isLoggedIn, session.webId, session.sessionId, isOAuthCallback, hasSessionIndicator, hasSessionData, wasLoggedIn, isLoginPage, router]);

 
  if (isCheckingSession || isOAuthCallback) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    );
  }

  // If OAuth callback is on login page, we're still processing - show loading
  // This handles the case where OAuth redirects back to /login
  if (isOAuthCallback && isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    );
  }

  // If not authenticated and not on login page, redirect will happen in useEffect
  // If authenticated and on login page, redirect will happen in useEffect
  // For now, just show children (or nothing if redirecting)
  if (!session.isLoggedIn && !isLoginPage) {
    return null; // Redirecting to login
  }

  if (session.isLoggedIn && isLoginPage) {
    return null; // Redirecting to home
  }

  // User is authenticated and on correct page, show the app
  return <>{children}</>;
}
