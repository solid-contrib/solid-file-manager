"use client";

import { useState, useRef, useEffect, useMemo, ReactNode, useId } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export interface ComboboxOption {
  label: string;
  value: string;
  secondaryLabel?: string;
  icon?: ReactNode;
}

interface UrlComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: ComboboxOption) => void;
  onSubmit?: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  leftIcon?: ReactNode;
  showChevron?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
  inputClassName?: string;
  renderOption?: (option: ComboboxOption, isHighlighted: boolean, index: number) => ReactNode;
}

export default function UrlCombobox({
  value,
  onChange,
  onSelect,
  onSubmit,
  options,
  placeholder = "Enter a URL or select from the list",
  label,
  error,
  disabled = false,
  leftIcon,
  showChevron = true,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className = "",
  inputClassName = "",
  renderOption,
}: UrlComboboxProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || `combobox-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

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

  // Filter options based on input
  const filteredOptions = useMemo(() => {
    if (!value.trim()) return options;
    const query = value.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query) ||
      option.secondaryLabel?.toLowerCase().includes(query)
    );
  }, [value, options]);

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    onSelect?.(option);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } else if (e.key === "Enter" && onSubmit && value.trim()) {
        e.preventDefault();
        onSubmit(value.trim());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (onSubmit && value.trim()) {
          onSubmit(value.trim());
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const hasError = !!error;
  const paddingLeft = leftIcon ? "pl-9" : "px-4";
  const paddingRight = showChevron ? "pr-10" : "pr-4";

  const defaultRenderOption = (option: ComboboxOption, isHighlighted: boolean, index: number) => (
    <button
      id={`${inputId}-option-${index}`}
      type="button"
      onClick={() => handleSelect(option)}
      className={`w-full px-4 py-3 text-left focus:outline-none ${
        isHighlighted ? "bg-gray-100" : "hover:bg-gray-100"
      }`}
      role="option"
      aria-selected={value === option.value}
    >
      <div className="flex items-center gap-3">
        {option.icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {option.label}
          </div>
          {option.secondaryLabel && (
            <div className="text-xs text-gray-500 truncate">
              {option.secondaryLabel}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className={`w-full ${className}`}>
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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10">
            {leftIcon}
          </div>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-12 w-full rounded-md border bg-white text-black placeholder:text-gray-500 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${paddingLeft} ${paddingRight} ${
            hasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-[#7B42F6] focus:ring-[#7B42F6]"
          } ${inputClassName}`}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={error ? `${inputId}-error` : ariaDescribedBy}
          aria-invalid={hasError}
          aria-expanded={showDropdown}
          aria-activedescendant={highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          autoComplete="off"
        />
        {showChevron && (
          <button
            type="button"
            onClick={() => {
              setShowDropdown(!showDropdown);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            aria-label={showDropdown ? "Hide options" : "Show options"}
            aria-expanded={showDropdown}
            tabIndex={-1}
          >
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Dropdown with options */}
        {showDropdown && filteredOptions.length > 0 && (
          <div
            ref={dropdownRef}
            id={listboxId}
            className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto"
            role="listbox"
            aria-label="Options"
          >
            {filteredOptions.map((option, index) => (
              renderOption 
                ? renderOption(option, highlightedIndex === index, index)
                : defaultRenderOption(option, highlightedIndex === index, index)
            ))}
          </div>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
