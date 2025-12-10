"use client";

import { useState, useEffect } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Button from "./shared/Button";
import UrlCombobox, { ComboboxOption } from "./shared/UrlCombobox";

const PRESET_ISSUERS: ComboboxOption[] = [
  { label: "Solid Community", value: "https://solidcommunity.net/", secondaryLabel: "https://solidcommunity.net/" },
  { label: "Inrupt", value: "https://login.inrupt.com", secondaryLabel: "https://login.inrupt.com" },
];

export default function LoginPage() {
  const { session, login } = useSolidAuth();
  const router = useRouter();
  const [issuerInput, setIssuerInput] = useState<string>(
    process.env.NEXT_PUBLIC_OIDC_ISSUER || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (session.isLoggedIn) {
      router.replace("/");
    }
  }, [session.isLoggedIn, router]);

  // Don't render login form if already authenticated (redirecting)
  if (session.isLoggedIn) {
    return null;
  }

  const validateIssuerUrl = (url: string): boolean => {
    if (!url.trim()) {
      setError("Please enter a Solid Identity Provider URL");
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        setError("URL must start with http:// or https://");
        return false;
      }
    } catch {
      setError("Please enter a valid URL");
      return false;
    }

    setError(null);
    return true;
  };

  const handleLogin = async () => {
    const trimmedIssuer = issuerInput.trim();
    if (!validateIssuerUrl(trimmedIssuer)) {
      return;
    }

    setIsLoading(true);
    try {
      await login(trimmedIssuer);
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const handleIssuerChange = (value: string) => {
    setIssuerInput(value);
    if (error) {
      setError(null);
    }
  };

  return (
    <main className="flex min-h-screen bg-white" role="main" aria-label="Sign in page">
      {/* Left side - Logo and branding */}
      <section
        className="hidden flex-1 items-center justify-center border-r border-gray-200 bg-[#F3EDFF] px-8 lg:flex"
        aria-label="Branding section"
      >
        <div className="max-w-md">
          <header className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center justify-center w-[200px] h-[200px]">
              <Image
                src="/file-manager-logo.svg"
                alt="Solid File Manager Logo"
                width={60}
                height={60}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <h1 className="mb-2 text-4xl font-normal text-black">Sign in</h1>
            <p className="text-base text-gray-600">
              to continue to Solid File Manager
            </p>
          </header>
        </div>
      </section>

      {/* Right side - Login form */}
      <section
        className="flex w-full flex-1 items-center justify-center bg-white px-4 py-12 lg:w-auto lg:min-w-[450px]"
        aria-label="Sign in form section"
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <header className="mb-8 lg:hidden flex flex-col items-center justify-center">
            <div className="mb-2 flex items-center justify-center w-[200px] h-[200px]">
              <Image
                src="/file-manager-logo.svg"
                alt="Solid File Manager Logo"
                width={60}
                height={60}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <h1 className="mb-2 text-center text-3xl font-normal text-black">Sign in</h1>
            <p className="text-center text-base text-gray-600">
              to continue to Solid File Manager
            </p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-6"
            aria-label="Sign in form"
            noValidate
          >
            {/* Identity Provider Input */}
            <UrlCombobox
              id="oidc-issuer"
              label="Solid Identity Provider"
              value={issuerInput}
              onChange={handleIssuerChange}
              options={PRESET_ISSUERS}
              placeholder="Enter your provider URL or select from the list"
              error={error || undefined}
              disabled={isLoading}
              aria-label="Enter or select Solid Identity Provider"
            />

            {/* Action button */}
            <div className="flex items-center justify-end pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                isLoading={isLoading}
                aria-label={isLoading ? "Signing in, please wait" : "Continue to sign in"}
              >
                {isLoading ? "Signing in..." : "Next"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
