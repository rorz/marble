import type { ResourceDeps } from "../../db";
import type { CreateParams, DbRow, Entity, UpdateParams } from "../../types";
import { toCamelKeys } from "../../types";
import {
  requireReadableVersion,
  requireServiceSupabase,
  requireWritableVersion,
} from "./access";

type ProgramFile = Entity<"program_file">;

export type CreateProgramFileInput = Pick<
  CreateParams<"program_file">,
  "content" | "filename" | "filetype" | "versionId"
>;

export type ListProgramFilesInput = {
  versionId?: string;
  versionIds?: string[];
};

export type UpdateProgramFileInput = Partial<
  Pick<UpdateParams<"program_file">, "content" | "filename" | "filetype">
>;

async function getFile(deps: ResourceDeps, id: string) {
  const { data, error } = await requireServiceSupabase(deps)
    .from("program_file")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Program file not found.");
  }

  return toCamelKeys<"program_file">(data as DbRow<"program_file">);
}

async function assertFilenameAvailable(
  deps: ResourceDeps,
  input: {
    exceptId?: string;
    filename: string;
    versionId: string;
  },
) {
  const { data, error } = await requireServiceSupabase(deps)
    .from("program_file")
    .select("id")
    .eq("version_id", input.versionId)
    .eq("filename", input.filename)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.id !== input.exceptId) {
    throw new Error("Program files must have unique filenames per version.");
  }
}

function normalizeVersionIds(input: ListProgramFilesInput = {}) {
  return [
    ...(input.versionId
      ? [
          input.versionId,
        ]
      : []),
    ...(input.versionIds ?? []),
  ].filter(
    (versionId, index, versionIds) => versionIds.indexOf(versionId) === index,
  );
}

function assertUniqueFilenames(files: Array<Pick<ProgramFile, "filename">>) {
  const filenames = new Set<string>();

  for (const file of files) {
    if (filenames.has(file.filename)) {
      throw new Error(`Program file '${file.filename}' already exists.`);
    }

    filenames.add(file.filename);
  }
}

export class ProgramFileCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreateProgramFileInput) => {
    const version = await requireWritableVersion(this.deps, input.versionId);

    await assertFilenameAvailable(this.deps, {
      filename: input.filename,
      versionId: input.versionId,
    });

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("program_file")
      .insert({
        content: input.content,
        filename: input.filename,
        filetype: input.filetype,
        owner_profile_id: version.program.ownerProfileId,
        version_id: input.versionId,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create program file.");
    }

    return toCamelKeys<"program_file">(data as DbRow<"program_file">);
  };

  public readonly delete = async (id: string) => {
    const file = await getFile(this.deps, id);

    await requireWritableVersion(this.deps, file.versionId);

    const { error } = await requireServiceSupabase(this.deps)
      .from("program_file")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return file;
  };

  public readonly get = async (id: string) => {
    const file = await getFile(this.deps, id);

    await requireReadableVersion(this.deps, file.versionId);

    return file;
  };

  public readonly list = async (input: ListProgramFilesInput = {}) => {
    const versionIds = normalizeVersionIds(input);

    if (versionIds.length === 0) {
      return [];
    }

    const readableVersionIds = new Set<string>();

    for (const versionId of versionIds) {
      try {
        await requireReadableVersion(this.deps, versionId);
        readableVersionIds.add(versionId);
      } catch {
        // Treat inaccessible versions the same as absent rows.
      }
    }

    if (readableVersionIds.size === 0) {
      return [];
    }

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("program_file")
      .select("*")
      .in("version_id", [
        ...readableVersionIds,
      ])
      .order("filename");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((file) =>
      toCamelKeys<"program_file">(file as DbRow<"program_file">),
    );
  };

  public readonly syncForVersion = async (
    versionId: string,
    files: Omit<CreateProgramFileInput, "versionId">[],
  ) => {
    assertUniqueFilenames(files);

    const existingFiles = await this.list({
      versionId,
    });
    const existingByFilename = new Map(
      existingFiles.map((file) => [
        file.filename,
        file,
      ]),
    );
    const incomingFilenames = new Set(files.map((file) => file.filename));

    await Promise.all(
      files.map((file) => {
        const existing = existingByFilename.get(file.filename);

        if (!existing) {
          return this.create({
            ...file,
            versionId,
          });
        }

        if (
          existing.content === file.content &&
          existing.filetype === file.filetype
        ) {
          return existing;
        }

        return this.update(existing.id, file);
      }),
    );

    await Promise.all(
      existingFiles
        .filter((file) => !incomingFilenames.has(file.filename))
        .map((file) => this.delete(file.id)),
    );

    return this.list({
      versionId,
    });
  };

  public readonly update = async (
    id: string,
    input: UpdateProgramFileInput,
  ) => {
    const file = await getFile(this.deps, id);

    await requireWritableVersion(this.deps, file.versionId);

    if (input.filename && input.filename !== file.filename) {
      await assertFilenameAvailable(this.deps, {
        exceptId: id,
        filename: input.filename,
        versionId: file.versionId,
      });
    }

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("program_file")
      .update({
        content: input.content,
        filename: input.filename,
        filetype: input.filetype,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not update program file.");
    }

    return toCamelKeys<"program_file">(data as DbRow<"program_file">);
  };
}
