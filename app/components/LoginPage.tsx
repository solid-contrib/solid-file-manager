"use client";

import { useState } from "react";
import { login } from "@inrupt/solid-client-authn-browser";
import Image from "next/image";
import Button from "./shared/Button";

const OIDC_ISSUERS = [
  { label: "Solid Community", value: "https://solidcommunity.net/" },
  { label: "Inrupt", value: "https://login.inrupt.com" },
  { label: "Local CSS (ACP)", value: "http://localhost:3000/" },
] as const;

export default function LoginPage() {
  const [selectedIssuer, setSelectedIssuer] = useState<string>(
    process.env.NEXT_PUBLIC_OIDC_ISSUER || OIDC_ISSUERS[0].value
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      await login({
        oidcIssuer: selectedIssuer,
        clientName: "Solid File Manager",
        redirectUrl: baseUrl,
      });
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
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
            {/* Identity Provider Selection */}
            <div>
              <label
                htmlFor="oidc-issuer"
                className="mb-2 block text-sm font-medium text-black"
              >
                Solid Identity Provider
              </label>
              <select
                id="oidc-issuer"
                name="oidc-issuer"
                value={selectedIssuer}
                onChange={(e) => setSelectedIssuer(e.target.value)}
                className="h-12 w-full cursor-pointer rounded-md border border-gray-300 bg-white px-4 text-black focus:border-[#7B42F6] focus:outline-none focus:ring-1 focus:ring-[#7B42F6] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                required
                aria-required="true"
                aria-label="Select Solid Identity Provider"
                aria-describedby="oidc-issuer-description"
              >
                {OIDC_ISSUERS.map((issuer) => (
                  <option key={issuer.value} value={issuer.value}>
                    {issuer.label}
                  </option>
                ))}
              </select>
              <p id="oidc-issuer-description" className="sr-only">
                Choose your Solid Identity Provider to sign in
              </p>
            </div>

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

