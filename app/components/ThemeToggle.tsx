"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, [resolvedTheme]);

    if (!mounted) {
        return (
            <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Toggle theme"
            />
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
        >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
    )
}