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

        // The library uses this to restore session state from localStorage
        const redirectInfo = await handleIncomingRedirect({
          restorePreviousSession: true,
        });

        // Get the session instance after handling redirect
        const session = getDefaultSession();

        // development logs (I will remove later)
        console.log("=== Session Check ===");
        console.log("Redirect Info:", redirectInfo);
        console.log("Session Info:", session.info);
        console.log("Is Logged In:", session.info.isLoggedIn);
        console.log("WebID:", session.info.webId);
        console.log("Session ID:", session.info.sessionId);
        if (session.info.expirationDate) {
          const expDate = new Date(session.info.expirationDate);
          console.log("Expiration Date:", expDate.toISOString());
          console.log("Is Expired:", expDate <= new Date());
        }

        let isLoggedIn = session.info.isLoggedIn && !!session.info.webId;

        // Check expiration if session exists
        if (isLoggedIn && session.info.expirationDate) {
          const expirationDate = new Date(session.info.expirationDate);
          const now = new Date();
          if (expirationDate <= now) {
            console.log("Session expired, user needs to re-login");
            isLoggedIn = false;
          }
        }



        setIsAuthenticated(isLoggedIn);
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
          const redirectInfo = await handleIncomingRedirect({
            restorePreviousSession: true,
          });
          const session = getDefaultSession();
          if (session.info.isLoggedIn) {
            // more logs (i will remove them later)
            console.log("=== Authentication Response (from polling) ===");
            console.log("Redirect Info:", redirectInfo);
            console.log("Session Info:", session.info);
            console.log("WebID:", session.info.webId);
            console.log("Is Logged In:", session.info.isLoggedIn);
            console.log("Session ID:", session.info.sessionId);
            console.log("==============================================");

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

    handleIncomingRedirect({ restorePreviousSession: true })
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

