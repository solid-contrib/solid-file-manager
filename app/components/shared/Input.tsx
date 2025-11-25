"use client";

import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  leftIcon,
  rightIcon,
  error,
  helperText,
  className = "",
  id,
  ...props
}, ref) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  const baseInputClasses =
    "h-9 w-full rounded-md border bg-white px-3 text-sm text-black placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-colors";
  const inputClasses = hasError
    ? `${baseInputClasses} border-red-300 focus:border-red-500 focus:ring-red-500`
    : `${baseInputClasses} border-gray-300 focus:border-[#7B42F6] focus:ring-[#7B42F6]`;

  const paddingLeft = leftIcon ? "pl-9" : "pl-3";
  const paddingRight = rightIcon ? "pr-9" : "pr-3";

  return (
    <section className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-black"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${inputClasses} ${paddingLeft} ${paddingRight} ${className}`}
          aria-invalid={hasError}
          aria-describedby={
            error || helperText
              ? `${inputId}-${error ? "error" : "helper"}`
              : undefined
          }
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-xs text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1 text-xs text-gray-600">
          {helperText}
        </p>
      )}
    </section>
  );
});

export default Input;

