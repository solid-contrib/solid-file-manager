"use client";

import { useEffect, useState } from "react";
import {
  getDefaultSession,
  handleIncomingRedirect,
} from "@inrupt/solid-client-authn-browser";
import LoginPage from "./LoginPage";
import LoadingSpinner from "./shared/LoadingSpinner";
import ErrorDisplay from "./shared/ErrorDisplay";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        setError(null);
        await handleIncomingRedirect();
        const session = getDefaultSession();
        setIsAuthenticated(session.info.isLoggedIn);
      } catch (err) {
        console.error("Auth check failed:", err);
        const errorMessage =
          err instanceof Error ? err : new Error("Authentication check failed");
        setError(errorMessage);
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, []);

  // Re-check authentication state periodically in case user logs in from another tab
  useEffect(() => {
    if (!isAuthenticated && !error) {
      const interval = setInterval(async () => {
        try {
          await handleIncomingRedirect();
          const session = getDefaultSession();
          if (session.info.isLoggedIn) {
            setIsAuthenticated(true);
            setError(null);
          }
        } catch (err) {
          console.error("Auth polling failed:", err);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, error]);

  const handleRetry = () => {
    setError(null);
    setIsChecking(true);
    setIsAuthenticated(null);
    // Trigger re-check
    handleIncomingRedirect()
      .then(() => {
        const session = getDefaultSession();
        setIsAuthenticated(session.info.isLoggedIn);
      })
      .catch((err) => {
        const errorMessage =
          err instanceof Error ? err : new Error("Authentication check failed");
        setError(errorMessage);
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsChecking(false);
      });
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Authentication Error"
        message={error.message || "Failed to authenticate. Please try again."}
        onRetry={handleRetry}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

