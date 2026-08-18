"use client";

import { useContext } from "react";
import {
    SolidAuthContext,
    type SolidAuthContextValue,
} from "@/app/components/providers/SolidAuthProvider";

export function useSolidAuth(): SolidAuthContextValue {
    const value = useContext(SolidAuthContext);
    if (value === null) {
        throw new Error("useSolidAuth() must be called inside <SolidAuthProvider>");
    }
    return value;
}
