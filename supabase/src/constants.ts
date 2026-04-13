import type { Database } from "./types";

type EnumRecord<
  SchemaName extends keyof Pick<Database, "graphql_public" | "public">,
> = {
  readonly [Name in keyof Database[SchemaName]["Enums"]]: readonly Database[SchemaName]["Enums"][Name][];
};

// Keep runtime enum constants out of the generated file so dev servers do not
// observe an empty module while typegen is rewriting `types.ts`.
export const Constants = {
  graphql_public: {
    Enums: {} satisfies EnumRecord<"graphql_public">,
  },
  public: {
    Enums: {
      data_operation: [
        "Create",
        "Read",
        "Update",
        "Delete",
      ],
      event_source: [
        "WEB_APP",
        "RAW_API",
        "CLI",
      ],
      profile_type: [
        "Human",
        "Agent",
      ],
      program_file_type: [
        "TypeScript",
        "Json",
        "Markdown",
      ],
    } satisfies EnumRecord<"public">,
  },
} as const;
