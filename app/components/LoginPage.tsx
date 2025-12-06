"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { login } from "@inrupt/solid-client-authn-browser";
import Image from "next/image";
import Button from "./shared/Button";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

const PRESET_ISSUERS = [
  { label: "Solid Community", value: "https://solidcommunity.net/" },
  { label: "Inrupt", value: "https://login.inrupt.com" },
] as const;

export default function LoginPage() {
  const [issuerInput, setIssuerInput] = useState<string>(
    process.env.NEXT_PUBLIC_OIDC_ISSUER || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

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
      const baseUrl = window.location.origin + window.location.pathname;
      await login({
        oidcIssuer: trimmedIssuer,
        clientName: "Solid File Manager",
        redirectUrl: baseUrl,
      });
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const handleIssuerSelect = (value: string) => {
    setIssuerInput(value);
    setShowDropdown(false);
    setError(null);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIssuerInput(e.target.value);
    setHighlightedIndex(-1);
    if (error) {
      setError(null);
    }
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  // Filter preset issuers based on input
  const filteredIssuers = useMemo(() => {
    return PRESET_ISSUERS.filter((issuer) => {
      if (!issuerInput.trim()) return true;
      const query = issuerInput.toLowerCase();
      return (
        issuer.label.toLowerCase().includes(query) ||
        issuer.value.toLowerCase().includes(query)
      );
    });
  }, [issuerInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setShowDropdown(true);
        setHighlightedIndex(-1);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredIssuers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (highlightedIndex >= 0 && highlightedIndex < filteredIssuers.length) {
          e.preventDefault();
          handleIssuerSelect(filteredIssuers[highlightedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
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
            <div>
              <label
                htmlFor="oidc-issuer"
                className="mb-2 block text-sm font-medium text-black"
              >
                Solid Identity Provider
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="oidc-issuer"
                  name="oidc-issuer"
                  type="text"
                  value={issuerInput}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your provider URL or select from the list"
                  className={`h-12 w-full rounded-md border bg-white px-4 pr-10 text-black placeholder:text-gray-500 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    error
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-[#7B42F6] focus:ring-[#7B42F6]"
                  }`}
                  disabled={isLoading}
                  required
                  aria-required="true"
                  aria-label="Enter or select Solid Identity Provider"
                  aria-describedby={error ? "oidc-issuer-error" : "oidc-issuer-description"}
                  aria-invalid={!!error}
                  aria-expanded={showDropdown}
                  aria-activedescendant={highlightedIndex >= 0 ? `issuer-option-${highlightedIndex}` : undefined}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="issuer-listbox"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(!showDropdown);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  aria-label={showDropdown ? "Hide provider options" : "Show provider options"}
                  aria-expanded={showDropdown}
                >
                  <ChevronDownIcon className={`h-5 w-5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown with preset options */}
                {showDropdown && filteredIssuers.length > 0 && (
                  <div
                    ref={dropdownRef}
                    id="issuer-listbox"
                    className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto"
                    role="listbox"
                    aria-label="Preset identity providers"
                  >
                    {filteredIssuers.map((issuer, index) => (
                      <button
                        key={issuer.value}
                        id={`issuer-option-${index}`}
                        type="button"
                        onClick={() => handleIssuerSelect(issuer.value)}
                        className={`w-full px-4 py-3 text-left focus:outline-none ${
                          highlightedIndex === index
                            ? "bg-gray-100"
                            : "hover:bg-gray-100"
                        }`}
                        role="option"
                        aria-selected={issuerInput === issuer.value}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {issuer.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {issuer.value}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {error && (
                <p id="oidc-issuer-error" className="mt-1 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}
              <p id="oidc-issuer-description" className="sr-only">
                Enter your Solid Identity Provider URL or select from the preset options
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

