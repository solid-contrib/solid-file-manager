"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSolidAuth } from "../lib/hooks/useSolidAuth";
import FullPageLoader from "./shared/FullPageLoader";

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { status } = useSolidAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  // Fail closed: children mount only once a session is confirmed, so nothing
  // downstream can fetch before there is anything to authenticate with.
  if (status !== "authenticated") return <FullPageLoader />;

  return <>{children}</>;
}
