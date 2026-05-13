"use client";

import { useId } from "react";
import type { MarbleInputProps } from "./input";
import { MarbleInput } from "./input";

export type MarbleSearchSelectOption =
  | string
  | {
      label?: string;
      value: string;
    };

export type MarbleSearchSelectProps = Omit<MarbleInputProps, "type"> & {
  options: ReadonlyArray<MarbleSearchSelectOption>;
};

const normalizeOption = (option: MarbleSearchSelectOption) => {
  return typeof option === "string"
    ? {
        label: option,
        value: option,
      }
    : {
        label: option.label ?? option.value,
        value: option.value,
      };
};

export const MarbleSearchSelect = ({
  autoComplete = "off",
  list,
  options,
  ...props
}: MarbleSearchSelectProps) => {
  const generatedId = useId();
  const normalizedOptions = options.map(normalizeOption);
  const datalistId = list ?? `marble-search-select-${generatedId}`;

  return (
    <>
      <MarbleInput
        autoComplete={autoComplete}
        list={datalistId}
        type="text"
        {...props}
      />
      <datalist id={datalistId}>
        {normalizedOptions.map((option) => (
          <option
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </datalist>
    </>
  );
};
