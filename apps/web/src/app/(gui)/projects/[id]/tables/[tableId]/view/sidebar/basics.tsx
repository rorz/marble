import {
  MarbleAlert,
  MarbleField,
  MarbleInput,
  MarbleSelect,
} from "@marble/ui";
import type { Program } from "../types";

type ColumnBasicsProps = {
  hasManualInput: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onProgramIdChange: (programId: string) => void;
  onRunConditionEnabledChange: (enabled: boolean) => void;
  programId: string;
  programs: Program[];
  runConditionEnabled: boolean;
};

export const ColumnBasics = ({
  hasManualInput,
  name,
  onNameChange,
  onProgramIdChange,
  onRunConditionEnabledChange,
  programId,
  programs,
  runConditionEnabled,
}: ColumnBasicsProps) => (
  <>
    <MarbleField
      label="Name"
      labelClassName="text-taupe-700"
    >
      <MarbleInput
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="e.g. Uppercased"
        type="text"
        value={name}
        wrapperClassName="w-full"
      />
    </MarbleField>

    <MarbleField
      label="Program"
      labelClassName="text-taupe-700"
    >
      <MarbleSelect
        onChange={(event) => onProgramIdChange(event.target.value)}
        value={programId}
        wrapperClassName="w-full"
      >
        <option value="">Select program...</option>
        {programs.map((program) => (
          <option
            key={program.id}
            value={program.id}
          >
            {program.name}
          </option>
        ))}
      </MarbleSelect>
    </MarbleField>

    {hasManualInput ? (
      <MarbleAlert
        size="sm"
        tone="warning"
      >
        This program reads from cell.manualInputValue — cells will be editable.
      </MarbleAlert>
    ) : null}

    <MarbleField
      description="Auto-run only happens after upstream cells execute and the resolved input validates for this program."
      label="Execution"
      labelClassName="text-taupe-700"
    >
      <MarbleSelect
        onChange={(event) =>
          onRunConditionEnabledChange(event.target.value === "auto")
        }
        value={runConditionEnabled ? "auto" : "manual"}
        wrapperClassName="w-full"
      >
        <option value="manual">Manual only</option>
        <option value="auto">Auto when ready</option>
      </MarbleSelect>
    </MarbleField>
  </>
);
