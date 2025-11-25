"use client";

import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import LoadingSpinner from "./LoadingSpinner";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "icon";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = "secondary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...props
}, ref) {
  const baseStyles = "cursor-pointer rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#7B42F6] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const variantStyles = {
    primary: "bg-[#7B42F6] text-white hover:bg-[#6B35E5] disabled:bg-gray-300 disabled:text-gray-500",
    secondary: "border border-gray-300 bg-white text-black hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100",
    icon: "text-gray-600 hover:bg-gray-100 p-1",
  };

  const sizeStyles = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={combinedClassName}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <LoadingSpinner size="sm" className="m-0" />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;

