import { describe, expect, test } from "bun:test";
import { CellCollection, type ResourceActions } from "@marble/store";
import type { SupabaseClient } from "@marble/supabase";

const CELL_ID = "00000000-0000-4000-8000-000000000001";
const COLUMN_ID = "00000000-0000-4000-8000-000000000002";
const PROGRAM_VERSION_ID = "00000000-0000-4000-8000-000000000003";
const PROFILE_ID = "00000000-0000-4000-8000-000000000004";
const PROJECT_ID = "00000000-0000-4000-8000-000000000005";
const ROW_ID = "00000000-0000-4000-8000-000000000006";
const RUN_ID = "00000000-0000-4000-8000-000000000007";
const TABLE_ID = "00000000-0000-4000-8000-000000000008";

type CellCollectionDeps = ConstructorParameters<typeof CellCollection>[0];
type ExecuteProgramRun = NonNullable<ResourceActions["executeProgramRun"]>;

type RecordedUpdate = {
  id: string;
  table: string;
  values: Record<string, unknown>;
};

const pendingState = {
  ok: null,
};

const dispatchFailureState = (
  message: string,
  detail?: Record<string, unknown>,
) => ({
  error: {
    type: "ExecutorDispatch",
    ...(detail === undefined
      ? {}
      : {
          detail,
        }),
  },
  message,
  ok: false,
});

const singleSelectValue = (table: string): Record<string, unknown> => {
  switch (table) {
    case "cell":
      return {
        column_id: COLUMN_ID,
        id: CELL_ID,
        row_id: ROW_ID,
      };
    case "column":
      return {
        program_version_id: PROGRAM_VERSION_ID,
        table_id: TABLE_ID,
      };
    case "project":
      return {
        owner_profile_id: PROFILE_ID,
      };
    case "table":
      return {
        project_id: PROJECT_ID,
      };
    default:
      throw new Error(`Unexpected select from ${table}.`);
  }
};

const successfulSingle = (data: Record<string, unknown>) => ({
  data,
  error: null,
});

const createSupabase = (updates: RecordedUpdate[]): SupabaseClient =>
  ({
    from: (table: string) => ({
      insert: (_values: Record<string, unknown>) => ({
        select: (_columns: string) => ({
          single: async () =>
            successfulSingle({
              id: RUN_ID,
            }),
        }),
      }),
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          single: async () => successfulSingle(singleSelectValue(table)),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: string) => {
          updates.push({
            id,
            table,
            values,
          });

          return {
            error: null,
          };
        },
      }),
    }),
  }) as unknown as SupabaseClient;

const createFixture = (executeProgramRun: ExecuteProgramRun) => {
  const updates: RecordedUpdate[] = [];
  const supabase = createSupabase(updates);

  return {
    collection: new CellCollection({
      actions: {
        executeProgramRun,
      },
      context: {
        profileId: PROFILE_ID,
      },
      db: {} as CellCollectionDeps["db"],
      serviceSupabase: supabase,
      supabase,
    }),
    updates,
  };
};

describe("CellCollection.run executor dispatch failures", () => {
  test("persists a terminal failure when executor dispatch throws", async () => {
    const { collection, updates } = createFixture(async () => {
      throw new Error("executor offline");
    });
    const failureState = dispatchFailureState("executor offline");

    await expect(
      collection.run({
        id: CELL_ID,
      }),
    ).rejects.toThrow("executor offline");
    expect(updates).toEqual([
      {
        id: CELL_ID,
        table: "cell",
        values: {
          state: pendingState,
        },
      },
      {
        id: CELL_ID,
        table: "cell",
        values: {
          state: failureState,
        },
      },
      {
        id: RUN_ID,
        table: "program_run",
        values: {
          output: failureState,
        },
      },
    ]);
  });

  test("persists a terminal failure when executor rejects the run", async () => {
    const { collection, updates } = createFixture(async () => ({
      payload: {
        message: "Executor unavailable",
        success: false,
      },
      status: 503,
    }));
    const failureState = dispatchFailureState("Executor unavailable", {
      status: 503,
    });

    await expect(
      collection.run({
        id: CELL_ID,
      }),
    ).rejects.toThrow("Executor unavailable");
    expect(updates).toEqual([
      {
        id: CELL_ID,
        table: "cell",
        values: {
          state: pendingState,
        },
      },
      {
        id: CELL_ID,
        table: "cell",
        values: {
          state: failureState,
        },
      },
      {
        id: RUN_ID,
        table: "program_run",
        values: {
          output: failureState,
        },
      },
    ]);
  });
});
