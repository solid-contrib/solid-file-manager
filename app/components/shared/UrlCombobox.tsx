"use client";

import { useId, useRef, type ReactNode } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

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
  const generatedId = useId();
  const inputId = id || `combobox-${generatedId}`;
  const highlightedRef = useRef<ComboboxOption | null>(null);
  const hasError = !!error;

  const filterOption = (item: ComboboxOption, query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      (item.secondaryLabel?.toLowerCase().includes(q) ?? false)
    );
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <Combobox
        items={options}
        value={null}
        onValueChange={(option) => {
          if (!option) return;
          onChange(option.value);
          onSelect?.(option);
        }}
        inputValue={value}
        onInputValueChange={onChange}
        onItemHighlighted={(item) => {
          highlightedRef.current = item ?? null;
        }}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(a, b) => a.value === b.value}
        filter={filterOption}
        disabled={disabled}
      >
        <ComboboxInput
          id={inputId}
          placeholder={placeholder}
          disabled={disabled}
          showTrigger={showChevron}
          aria-label={ariaLabel}
          aria-describedby={error ? `${inputId}-error` : ariaDescribedBy}
          aria-invalid={hasError || undefined}
          className={cn("w-full", inputClassName)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              onSubmit &&
              value.trim() &&
              !highlightedRef.current
            ) {
              e.preventDefault();
              onSubmit(value.trim());
            }
          }}
        >
          {leftIcon && (
            <InputGroupAddon align="inline-start">{leftIcon}</InputGroupAddon>
          )}
        </ComboboxInput>
        <ComboboxContent className="max-h-60">
          <ComboboxEmpty>No matches</ComboboxEmpty>
          <ComboboxList>
            {(option: ComboboxOption, index: number) => (
              <ComboboxItem key={option.value} value={option} className="py-2">
                {renderOption ? (
                  renderOption(option, false, index)
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {option.icon}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {option.label}
                      </div>
                      {option.secondaryLabel && (
                        <div className="truncate text-xs text-muted-foreground">
                          {option.secondaryLabel}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
