import { Glob } from "bun";
import * as ts from "typescript";
import * as fs from "node:fs";

const HELP_TEXT = `
Usage: bun scripts/codemods/enforce-arrow-function.ts [options]

Options:
  --file <path>    Run on a single file
  --dry-run        Print diffs without writing
  --help           Show this help message
`;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    file: null as string | null,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && i + 1 < args.length) {
      options.file = args[++i];
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    } else if (args[i] === "--help") {
      options.help = true;
    }
  }

  return options;
};

const getFiles = async (): Promise<string[]> => {
  const globs = [
    new Glob("apps/**/*.{ts,tsx}"),
    new Glob("packages/**/*.{ts,tsx}"),
    new Glob("supabase/**/*.ts"),
    new Glob("harness/**/*.ts"),
  ];

  const files: string[] = [];
  for (const glob of globs) {
    for await (const file of glob.scan(".")) {
      if (
        file.endsWith(".generated.ts") ||
        file.endsWith(".d.ts") ||
        file.includes("node_modules/") ||
        file.includes(".next/") ||
        file.includes("dist/") ||
        file.includes("build/")
      ) {
        continue;
      }
      files.push(file);
    }
  }
  return files;
};

interface Rewrite {
  start: number;
  end: number;
  newText: string;
}

const processFile = (filePath: string, dryRun: boolean): { modified: boolean; replacements: number; skippedReason?: string } => {
  const sourceText = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

  const functionDecls: ts.FunctionDeclaration[] = [];
  let hasBodyless = false;

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      if (!node.body) {
        hasBodyless = true;
      }
      functionDecls.push(node);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (hasBodyless) {
    return { modified: false, replacements: 0, skippedReason: "Contains bodyless function declaration (overload)" };
  }

  const rewrites: Rewrite[] = [];
  const isTsx = filePath.endsWith(".tsx");

  for (const decl of functionDecls) {
    if (decl.asteriskToken) {
      continue; // Skip generators
    }

    const fullStart = decl.getFullStart();
    const leadingTrivia = sourceText.substring(fullStart, decl.getStart(sourceFile));
    if (leadingTrivia.includes("harness-ignore: enforce-arrow-function")) {
      continue;
    }

    const isExport = decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const isDefault = decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
    const isAsync = decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;

    const name = decl.name?.text;
    
    const children = decl.getChildren(sourceFile);
    const openParen = children.find((c) => c.kind === ts.SyntaxKind.OpenParenToken);
    const closeParen = children.find((c) => c.kind === ts.SyntaxKind.CloseParenToken);
    const paramsText = openParen && closeParen ? sourceText.substring(openParen.getStart(sourceFile), closeParen.getEnd()) : "()";

    const lessThan = children.find((c) => c.kind === ts.SyntaxKind.LessThanToken);
    const greaterThan = children.find((c) => c.kind === ts.SyntaxKind.GreaterThanToken);
    let typeParamsText = lessThan && greaterThan ? sourceText.substring(lessThan.getStart(sourceFile), greaterThan.getEnd()) : "";

    if (isTsx && typeParamsText) {
      if (!typeParamsText.includes(",") && !typeParamsText.includes("extends") && !typeParamsText.includes("=")) {
        typeParamsText = typeParamsText.replace(/>$/, ",>");
      }
    }

    const colonToken = children.find((c) => c.kind === ts.SyntaxKind.ColonToken);
    const returnTypeText = colonToken && decl.type ? sourceText.substring(colonToken.getStart(sourceFile), decl.type.getEnd()) : "";

    const bodyText = decl.body ? sourceText.substring(decl.body.getStart(sourceFile), decl.body.getEnd()) : "{}";

    const asyncPrefix = isAsync ? "async " : "";
    const arrowFunc = `${asyncPrefix}${typeParamsText}${paramsText}${returnTypeText} => ${bodyText}`;

    let newText = "";

    if (isDefault) {
      if (name) {
        newText = `const ${name} = ${arrowFunc};\nexport default ${name};`;
      } else {
        newText = `export default ${arrowFunc};`;
      }
    } else if (isExport) {
      newText = `export const ${name} = ${arrowFunc};`;
    } else {
      if (name) {
        newText = `const ${name} = ${arrowFunc};`;
      } else {
        newText = `const anonymous = ${arrowFunc};`;
      }
    }

    rewrites.push({
      start: decl.getStart(sourceFile),
      end: decl.getEnd(),
      newText,
    });
  }

  if (rewrites.length === 0) {
    return { modified: false, replacements: 0 };
  }

  rewrites.sort((a, b) => b.start - a.start);

  let newSourceText = sourceText;
  for (const rewrite of rewrites) {
    newSourceText = newSourceText.substring(0, rewrite.start) + rewrite.newText + newSourceText.substring(rewrite.end);
  }

  if (dryRun) {
    console.log(`[dry-run] ${filePath} (${rewrites.length} replacements)`);
  } else {
    fs.writeFileSync(filePath, newSourceText, "utf-8");
    console.log(`[modified] ${filePath} (${rewrites.length} replacements)`);
  }

  return { modified: true, replacements: rewrites.length };
};

const main = async () => {
  const options = parseArgs();

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  let filesToProcess: string[] = [];
  if (options.file) {
    filesToProcess = [options.file];
  } else {
    filesToProcess = await getFiles();
  }

  let totalModified = 0;
  let totalReplacements = 0;
  let totalSkipped = 0;

  for (const file of filesToProcess) {
    try {
      const result = processFile(file, options.dryRun);
      if (result.modified) {
        totalModified++;
        totalReplacements += result.replacements;
      } else if (result.skippedReason) {
        totalSkipped++;
      }
    } catch (err) {
      console.error(`[error] Failed to process ${file}:`, err);
    }
  }

  console.log(`\nSummary:`);
  console.log(`Modified ${totalModified} files, ${totalReplacements} total replacements.`);
  if (totalSkipped > 0) {
    console.log(`Skipped ${totalSkipped} files due to overload conservatism.`);
  }
  
  process.exit(0);
};

main();
