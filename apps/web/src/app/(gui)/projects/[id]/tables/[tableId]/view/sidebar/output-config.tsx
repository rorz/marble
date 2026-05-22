import { cx, MarbleButton, MarbleTextarea } from "@marble/ui";
import type { Dispatch, SetStateAction } from "react";
import { updateProgramOutputSchema } from "../../actions";

type OutputConfigProps = {
  isCreate: boolean;
  latestVersionId: string | null;
  outputSchemaDirty: boolean;
  outputSchemaJson: string;
  outputSchemaOpen: boolean;
  savingOutputSchema: boolean;
  selectedProgramExists: boolean;
  setOutputSchemaDirty: Dispatch<SetStateAction<boolean>>;
  setOutputSchemaJson: Dispatch<SetStateAction<string>>;
  setOutputSchemaOpen: Dispatch<SetStateAction<boolean>>;
  setSavingOutputSchema: Dispatch<SetStateAction<boolean>>;
};

export const OutputConfig = ({
  isCreate,
  latestVersionId,
  outputSchemaDirty,
  outputSchemaJson,
  outputSchemaOpen,
  savingOutputSchema,
  selectedProgramExists,
  setOutputSchemaDirty,
  setOutputSchemaJson,
  setOutputSchemaOpen,
  setSavingOutputSchema,
}: OutputConfigProps) => {
  if (isCreate || !selectedProgramExists) {
    return null;
  }

  const saveOutputConfig = async () => {
    if (!latestVersionId) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputSchemaJson);
    } catch (error) {
      console.error("Invalid output config JSON", error);
      return;
    }

    setSavingOutputSchema(true);
    try {
      await updateProgramOutputSchema(latestVersionId, parsed);
      setOutputSchemaDirty(false);
    } finally {
      setSavingOutputSchema(false);
    }
  };

  return (
    <div className="border-t border-taupe-200 pt-4">
      <button
        className="flex w-full items-center gap-1.5 text-left text-[10px] text-taupe-600 uppercase tracking-wider"
        onClick={() => setOutputSchemaOpen((open) => !open)}
        type="button"
      >
        <span
          className={cx(
            "text-[8px] transition-transform",
            outputSchemaOpen && "rotate-90",
          )}
        >
          ▶
        </span>
        Output Config
        {outputSchemaDirty ? (
          <span className="text-orange-500 normal-case tracking-normal">
            (unsaved)
          </span>
        ) : null}
      </button>
      {outputSchemaOpen ? (
        <div className="mt-2 space-y-2">
          <MarbleTextarea
            monospace
            onChange={(event) => {
              setOutputSchemaJson(event.target.value);
              setOutputSchemaDirty(true);
            }}
            rows={8}
            size="xs"
            spellCheck={false}
            value={outputSchemaJson}
          />
          <MarbleButton
            className="w-full"
            disabled={
              !latestVersionId || !outputSchemaDirty || savingOutputSchema
            }
            onClick={() => {
              void saveOutputConfig();
            }}
          >
            {savingOutputSchema ? "Saving..." : "Save Output Config"}
          </MarbleButton>
        </div>
      ) : null}
    </div>
  );
};
