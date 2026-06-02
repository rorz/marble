#!/usr/bin/env node
import { rootCommand } from "./root";

await rootCommand.parseAsync(process.argv);
