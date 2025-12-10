"use client";

import { Suspense } from "react";
import AuthWrapper from "../components/AuthWrapper";
import LoginPage from "../components/LoginPage";

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthWrapper>
        <LoginPage />
      </AuthWrapper>
    </Suspense>
  );
}

