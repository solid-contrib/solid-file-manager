"use client";

import { useEffect, useState, useRef, Suspense } from "react";
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
    return keys.some(
      (key) =>
        key.includes("solidClientAuthn") ||
        key.includes("solid-auth") ||
        key.includes("oidc") ||
        key.includes("session"),
    );
  } catch {
    return false;
  }
}

function AuthWrapperContent({ children }: AuthWrapperProps) {
  const { session } = useSolidAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);
  const [oauthWaitExpired, setOauthWaitExpired] = useState(false);
  const [hasSessionIndicator] = useState(() => hasSessionInStorage());
  const wasLoggedInRef = useRef(false);

  const isOAuthCallback = searchParams.has("code") || searchParams.has("state");
  const isLoginPage = pathname === "/login";
  const hasSessionData = !!(session.webId || session.sessionId || session.clientAppId);

  useEffect(() => {
    if (session.isLoggedIn) {
      wasLoggedInRef.current = true;
    }
  }, [session.isLoggedIn]);

  useEffect(() => {
    if (!isOAuthCallback) {
      return;
    }

    if (session.isLoggedIn) {
      const redirectTimer = setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }, 200);
      return () => clearTimeout(redirectTimer);
    }

    const maxWaitTimer = setTimeout(() => {
      setOauthWaitExpired(true);
      setSessionCheckComplete(true);
    }, 10000);
    return () => clearTimeout(maxWaitTimer);
  }, [isOAuthCallback, session.isLoggedIn]);

  useEffect(() => {
    if (isOAuthCallback) {
      return;
    }

    if (session.isLoggedIn) {
      const timer = setTimeout(() => {
        setSessionCheckComplete(true);
        if (isLoginPage) {
          router.replace("/");
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    if (wasLoggedInRef.current && !session.isLoggedIn) {
      const timer = setTimeout(() => {
        setSessionCheckComplete(true);
        if (!isLoginPage) {
          router.replace("/login");
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    const shouldWaitForRestore = hasSessionData || hasSessionIndicator;
    const checkTimer = setTimeout(() => {
      setSessionCheckComplete(true);

      if (!session.isLoggedIn && !isLoginPage) {
        router.replace("/login");
      }
    }, shouldWaitForRestore ? 2000 : 200);

    return () => clearTimeout(checkTimer);
  }, [
    session.isLoggedIn,
    session.webId,
    session.sessionId,
    isOAuthCallback,
    hasSessionIndicator,
    hasSessionData,
    isLoginPage,
    router,
  ]);

  const showLoading =
    (isOAuthCallback && !session.isLoggedIn && !oauthWaitExpired) ||
    !sessionCheckComplete;

  if (showLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    );
  }

  if (!session.isLoggedIn && !isLoginPage) {
    return null;
  }

  if (session.isLoggedIn && isLoginPage) {
    return null;
  }

  return <>{children}</>;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <LoadingSpinner size="md" text="Loading..." />
        </div>
      }
    >
      <AuthWrapperContent>{children}</AuthWrapperContent>
    </Suspense>
  );
}
