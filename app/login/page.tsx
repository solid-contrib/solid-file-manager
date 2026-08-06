"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginPage from "../components/LoginPage";
import FullPageLoader from "../components/shared/FullPageLoader";
import { useSolidAuth } from "../lib/hooks/useSolidAuth";

export default function Login() {
  const router = useRouter();
  const { status } = useSolidAuth();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  // Hold the form back until we know there is no session to restore, so a
  // returning user is not shown a sign-in form on their way through.
  if (status !== "anonymous") return <FullPageLoader />;

  return <LoginPage />;
}
