"use client";

import { BrowserSolidLdoProvider } from "@ldo/solid-react";

export default function LdoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BrowserSolidLdoProvider>{children}</BrowserSolidLdoProvider>;
}

