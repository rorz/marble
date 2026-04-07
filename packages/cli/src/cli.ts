#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import dotenv from "dotenv";
import { MarbleClient } from "./client.js";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const program = new Command();

program
  .name("marble")
  .description("CLI to manage Marble programs and tables")
  .version("1.0.0");

const client = new MarbleClient();

// --- PROGRAMS ---
const programsCmd = program.command("programs").description("Manage programs");

programsCmd
  .command("list")
  .description("List all programs")
  .action(async () => {
    try {
      const data = await client.programs.list();
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error listing programs: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

programsCmd
  .command("get")
  .description("Get a program by ID")
  .argument("<id>", "Program ID")
  .action(async (id) => {
    try {
      const data = await client.programs.get(id);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error getting program: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

programsCmd
  .command("upsert")
  .description("Upsert a program from a local directory")
  .argument("<dir>", "Directory containing the program code and schema")
  .action(async (dir) => {
    const fullPath = path.resolve(process.cwd(), dir);
    try {
      const codePath = path.join(fullPath, "index.js");
      const configPath = path.join(fullPath, "config.json");

      const code = await fs.readFile(codePath, "utf-8");
      const configStr = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configStr);

      const payload = {
        name: config.name,
        code,
        inputSchema: config.inputSchema,
        outputConfig: config.outputConfig,
      };

      const data = await client.programs.upsert(payload);
      console.log(
        `Program "${config.name}" upserted successfully. (ID: ${data.id})`,
      );
    } catch (err) {
      console.error(
        `Error upserting program: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

programsCmd
  .command("dry-run")
  .description("Dry-run a program against the API")
  .argument("<dir>", "Directory containing the program code and schema")
  .argument("<input>", "Mock input payload as a stringified JSON object")
  .action(async (dir, inputStr) => {
    const fullPath = path.resolve(process.cwd(), dir);
    try {
      const codePath = path.join(fullPath, "index.js");
      const configPath = path.join(fullPath, "config.json");

      const code = await fs.readFile(codePath, "utf-8");
      const configStr = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configStr);

      let inputPayload: unknown;
      try {
        inputPayload = JSON.parse(inputStr);
      } catch {
        console.error("Invalid input JSON.");
        process.exit(1);
      }

      const outputSchema =
        config.outputConfig?.schema || config.outputSchema || {};

      const json = await client.programs.dryRun({
        code,
        input: inputPayload,
        outputSchema,
      });

      console.log(JSON.stringify(json, null, 2));
    } catch (err) {
      console.error(
        `Error dry-running program: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

// --- TABLES ---
const tablesCmd = program.command("tables").description("Manage tables");

tablesCmd
  .command("list")
  .description("List all tables")
  .action(async () => {
    try {
      const data = await client.tables.list();
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error listing tables: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

tablesCmd
  .command("get")
  .description("Get a table by ID")
  .argument("<id>", "Table ID")
  .action(async (id) => {
    try {
      const data = await client.tables.get(id);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error getting table: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

tablesCmd
  .command("create")
  .description("Create a new table")
  .argument("<name>", "Name of the table")
  .action(async (name) => {
    try {
      const data = await client.tables.create(name);
      console.log(`Table "${name}" created successfully. (ID: ${data.id})`);
    } catch (err) {
      console.error(
        `Error creating table: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

tablesCmd
  .command("delete")
  .description("Delete a table")
  .argument("<id>", "Table ID")
  .action(async (id) => {
    try {
      await client.tables.delete(id);
      console.log(`Table ${id} deleted successfully.`);
    } catch (err) {
      console.error(
        `Error deleting table: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

// --- COLUMNS ---
const columnsCmd = program.command("columns").description("Manage columns");

columnsCmd
  .command("add")
  .description("Add a column to a table")
  .argument("<tableId>", "ID of the table")
  .argument("<name>", "Name of the column")
  .argument("<programId>", "ID of the program")
  .argument("<inputTemplate>", "Input template stringified JSON (e.g. '{}')")
  .argument("<outputSchema>", "Output schema stringified JSON")
  .action(
    async (tableId, name, programId, inputTemplateStr, outputSchemaStr) => {
      let inputTemplate: string;
      let outputSchema: unknown;
      try {
        inputTemplate = inputTemplateStr; // stored as string
        outputSchema = JSON.parse(outputSchemaStr);
      } catch (err) {
        console.error(
          `Error parsing JSON arguments: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }

      try {
        const data = await client.columns.add(tableId, {
          name,
          programId,
          inputTemplate,
          outputSchema,
        });
        console.log(`Column "${name}" added successfully. (ID: ${data.id})`);
      } catch (err) {
        console.error(
          `Error adding column: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    },
  );

columnsCmd
  .command("list")
  .description("List columns in a table")
  .argument("<tableId>", "Table ID")
  .action(async (tableId) => {
    try {
      const data = await client.columns.list(tableId);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error listing columns: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

// --- ROWS ---
const rowsCmd = program.command("rows").description("Manage rows");

rowsCmd
  .command("add")
  .description("Add a row to a table")
  .argument("<tableId>", "ID of the table")
  .action(async (tableId) => {
    try {
      const data = await client.rows.add(tableId);
      console.log(
        `Row added successfully to table ${tableId}. (ID: ${data.id})`,
      );
    } catch (err) {
      console.error(
        `Error adding row: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

rowsCmd
  .command("list")
  .description("List rows in a table")
  .argument("<tableId>", "Table ID")
  .action(async (tableId) => {
    try {
      const data = await client.rows.list(tableId);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error listing rows: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

// --- CELLS ---
const cellsCmd = program.command("cells").description("Manage cells");

cellsCmd
  .command("get")
  .description("Get a cell by ID")
  .argument("<id>", "Cell ID")
  .action(async (id) => {
    try {
      const data = await client.cells.get(id);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(
        `Error getting cell: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program.parse();
