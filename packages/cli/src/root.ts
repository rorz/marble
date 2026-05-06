import { Command } from "commander";
import { registerCommands } from "./commands";

export function createRootCommand() {
  const command = new Command();

  command
    .name("marble")
    .description("Marble CLI")
    .showHelpAfterError()
    .showSuggestionAfterError();

  registerCommands(command);

  return command;
}

export const rootCommand = createRootCommand();
