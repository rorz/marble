"use client";

import {
	type CellValueChangedEvent,
	type ColDef,
	AllCommunityModule,
	ModuleRegistry,
	themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FormEvent,
} from "react";
import { createClient } from "@marble/supabase";
import type { Json } from "@marble/supabase";
import * as actions from "./actions";

ModuleRegistry.registerModules([AllCommunityModule]);

// ── Types ───────────────────────────────────────────────

type Program = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type TableInfo = Awaited<ReturnType<typeof actions.listTables>>[number];
type LoadedData = Awaited<ReturnType<typeof actions.loadTableData>>;
type Column = LoadedData["columns"][number];
type Row = LoadedData["rows"][number];
type Cell = LoadedData["cells"][number];
type Dependency = LoadedData["dependencies"][number];

type VariableSourceConfig = {
	source: "cell_value" | "column" | "literal";
	column_id?: string;
	value?: string;
};

// ── Theme ───────────────────────────────────────────────

const gridTheme = themeQuartz.withParams({
	backgroundColor: "#0a0a0a",
	foregroundColor: "#e5e5e5",
	headerBackgroundColor: "#171717",
	borderColor: "#2e2e2e",
	rowHoverColor: "#1a1a1a",
	headerFontSize: 12,
	fontSize: 13,
	headerFontWeight: 500,
	spacing: 6,
	wrapperBorderRadius: 8,
	cellHorizontalPaddingScale: 0.8,
});

// ── Helpers ─────────────────────────────────────────────

function displayValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

function isUserInputColumn(column: Column): boolean {
	const template = column.input_values_template as Record<string, unknown>;
	const variables = template?.variables as
		| Record<string, { source: string }>
		| undefined;
	if (!variables) return false;
	return Object.values(variables).some((v) => v.source === "cell_value");
}

function programLabel(program: Program): string {
	const code = program.code.trim();
	if (code.length <= 50) return code;
	return `${code.substring(0, 47)}...`;
}

function shortId(id: string): string {
	return id.substring(0, 8);
}

// ── Dependency graph ────────────────────────────────────

function buildDependencyGraph(deps: Dependency[]) {
	const graph = new Map<string, string[]>();
	for (const dep of deps) {
		const list = graph.get(dep.source_column_id) ?? [];
		list.push(dep.target_column_id);
		graph.set(dep.source_column_id, list);
	}
	return graph;
}

function getExecutionOrder(
	startColumnId: string,
	depGraph: Map<string, string[]>,
): string[] {
	const order: string[] = [startColumnId];
	const visited = new Set([startColumnId]);
	let i = 0;
	while (i < order.length) {
		for (const next of depGraph.get(order[i]) ?? []) {
			if (!visited.has(next)) {
				visited.add(next);
				order.push(next);
			}
		}
		i++;
	}
	return order;
}

// ── Component ───────────────────────────────────────────

export default function DemoPage() {
	const [tables, setTables] = useState<TableInfo[]>([]);
	const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
	const [columns, setColumns] = useState<Column[]>([]);
	const [rows, setRows] = useState<Row[]>([]);
	const [cells, setCells] = useState<Cell[]>([]);
	const [dependencies, setDependencies] = useState<Dependency[]>([]);
	const [programs, setPrograms] = useState<Program[]>([]);

	const [showAddColumn, setShowAddColumn] = useState(false);
	const [editingProgram, setEditingProgram] = useState<Program | null>(null);
	const [isNewProgram, setIsNewProgram] = useState(false);
	const [runLog, setRunLog] = useState<string[]>([]);
	const [running, setRunning] = useState(false);
	const [loading, setLoading] = useState(true);

	const gridRef = useRef<AgGridReact>(null);

	// Refs for latest state (avoids stale closures in AG Grid callbacks)
	const cellsRef = useRef(cells);
	cellsRef.current = cells;
	const columnsRef = useRef(columns);
	columnsRef.current = columns;
	const depsRef = useRef(dependencies);
	depsRef.current = dependencies;
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	// Cell lookup for grid rendering
	const cellMap = useMemo(() => {
		const map = new Map<string, Cell>();
		for (const cell of cells) {
			map.set(`${cell.row_id}:${cell.column_id}`, cell);
		}
		return map;
	}, [cells]);

	// ── Load data ─────────────────────────────────────────

	useEffect(() => {
		(async () => {
			const [t, p] = await Promise.all([
				actions.listTables(),
				actions.listPrograms(),
			]);
			setTables(t);
			setPrograms(p);
			if (t.length > 0) setSelectedTableId(t[0].id);
			setLoading(false);
		})();
	}, []);

	useEffect(() => {
		if (!selectedTableId) return;
		setLoading(true);
		actions.loadTableData(selectedTableId).then((data) => {
			setColumns(data.columns);
			setRows(data.rows);
			setCells(data.cells);
			setDependencies(data.dependencies);
			setLoading(false);
		});
	}, [selectedTableId]);

	// ── Realtime subscription (cells update live as executor writes) ──

	useEffect(() => {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!url || !key || !selectedTableId || columns.length === 0) return;

		const supabase = createClient(url, key);
		const columnIds = new Set(columns.map((c) => c.id));

		const channel = supabase
			.channel(`cells:${selectedTableId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "cell" },
				(payload) => {
					if (payload.eventType === "UPDATE") {
						const updated = payload.new as Cell;
						if (!columnIds.has(updated.column_id)) return;
						setCells((prev) =>
							prev.map((c) =>
								c.id === updated.id ? updated : c,
							),
						);
					} else if (payload.eventType === "INSERT") {
						const inserted = payload.new as Cell;
						if (!columnIds.has(inserted.column_id)) return;
						setCells((prev) => {
							if (prev.some((c) => c.id === inserted.id))
								return prev;
							return [...prev, inserted];
						});
					} else if (payload.eventType === "DELETE") {
						const deleted = payload.old as { id: string };
						setCells((prev) =>
							prev.filter((c) => c.id !== deleted.id),
						);
					}
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [selectedTableId, columns]);

	// ── AG Grid config ────────────────────────────────────

	const sortedColumns = useMemo(
		() => [...columns].sort((a, b) => a.index - b.index),
		[columns],
	);

	const colDefs = useMemo<ColDef[]>(() => {
		return [
			{
				headerName: "#",
				valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
				width: 52,
				pinned: "left" as const,
				sortable: false,
				suppressMovable: true,
				cellStyle: {
					color: "#666",
					fontFamily: "var(--font-geist-mono)",
				},
			},
			...sortedColumns.map((col) => {
				const isInput = isUserInputColumn(col);
				return {
					headerName: isInput
						? `Col ${col.index} (input)`
						: `Col ${col.index}`,
					headerTooltip: col.column_program
						? programLabel(col.column_program)
						: undefined,
					field: col.id,
					editable: isInput,
					cellStyle: {
						background: isInput ? "#111" : "transparent",
						fontFamily: "var(--font-geist-mono)",
					},
				} satisfies ColDef;
			}),
		];
	}, [sortedColumns]);

	const rowData = useMemo(() => {
		return rows.map((row) => {
			const data: Record<string, unknown> = {
				_rowId: row.id,
				_rowIndex: row.index,
			};
			for (const col of columns) {
				const cell = cellMap.get(`${row.id}:${col.id}`);
				data[col.id] = cell ? displayValue(cell.value) : "";
			}
			return data;
		});
	}, [rows, columns, cellMap]);

	// ── Execution (creates column_program_run → calls executor) ──

	const runProgramChain = useCallback(
		async (params: {
			startColumnId: string;
			targetRowId?: string;
			cellValue?: string;
		}) => {
			const currentCells = cellsRef.current;
			const currentColumns = columnsRef.current;
			const currentDeps = depsRef.current;
			const currentRows = rowsRef.current;

			const depGraph = buildDependencyGraph(currentDeps);
			const columnsById = new Map(
				currentColumns.map((c) => [c.id, c]),
			);

			const chainColumnIds = getExecutionOrder(
				params.startColumnId,
				depGraph,
			);
			const targetRows = params.targetRowId
				? currentRows.filter((r) => r.id === params.targetRowId)
				: currentRows;

			const cellLookup = new Map<string, Cell>();
			for (const cell of currentCells) {
				cellLookup.set(
					`${cell.row_id}:${cell.column_id}`,
					cell,
				);
			}

			const log: string[] = [];

			for (const colId of chainColumnIds) {
				const col = columnsById.get(colId);
				if (!col?.column_program) continue;

				for (const row of targetRows) {
					const cell = cellLookup.get(`${row.id}:${col.id}`);
					if (!cell) continue;

					const isStart = colId === params.startColumnId;
					const cellValue =
						isStart && isUserInputColumn(col)
							? params.cellValue
							: undefined;

					try {
						const result = await actions.executeRun({
							programId: col.program_id,
							cellId: cell.id,
							cellValue,
						});

						log.push(
							`run   Col ${col.index} × Row ${row.index}  run_id=${shortId(result.runId)}  program(${programLabel(col.column_program)})  → ${JSON.stringify(result.output)}`,
						);
					} catch (err) {
						log.push(
							`FAIL  Col ${col.index} × Row ${row.index}  ${err instanceof Error ? err.message : String(err)}`,
						);
					}
				}
			}

			return log;
		},
		[],
	);

	const onCellValueChanged = useCallback(
		async (event: CellValueChangedEvent) => {
			const rowId = event.data._rowId as string;
			const columnId = event.colDef.field;
			if (!columnId) return;

			setRunning(true);
			const log = await runProgramChain({
				startColumnId: columnId,
				targetRowId: rowId,
				cellValue: String(event.newValue ?? ""),
			});
			setRunLog((prev) => [...log, ...prev]);
			setRunning(false);
		},
		[runProgramChain],
	);

	const handleRunAll = useCallback(async () => {
		setRunning(true);
		setRunLog([]);

		const currentCells = cellsRef.current;
		const currentColumns = columnsRef.current;
		const currentRows = rowsRef.current;

		const sorted = [...currentColumns].sort(
			(a, b) => a.index - b.index,
		);

		const cellLookup = new Map<string, Cell>();
		for (const cell of currentCells) {
			cellLookup.set(
				`${cell.row_id}:${cell.column_id}`,
				cell,
			);
		}

		const log: string[] = [];

		for (const col of sorted) {
			if (!col.column_program) continue;
			if (isUserInputColumn(col)) {
				log.push(
					`keep  Col ${col.index} — user input, values unchanged`,
				);
				continue;
			}

			for (const row of currentRows) {
				const cell = cellLookup.get(`${row.id}:${col.id}`);
				if (!cell) continue;

				try {
					const result = await actions.executeRun({
						programId: col.program_id,
						cellId: cell.id,
					});

					log.push(
						`run   Col ${col.index} × Row ${row.index}  run_id=${shortId(result.runId)}  → ${JSON.stringify(result.output)}`,
					);
				} catch (err) {
					log.push(
						`FAIL  Col ${col.index} × Row ${row.index}  ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}
		}

		setRunLog(log);
		setRunning(false);
	}, []);

	// ── CRUD handlers ─────────────────────────────────────

	const handleAddRow = useCallback(async () => {
		if (!selectedTableId) return;
		const { row, cells: newCells } = await actions.createRow(
			selectedTableId,
		);
		setRows((prev) => [...prev, row]);
		setCells((prev) => [...prev, ...(newCells as Cell[])]);
	}, [selectedTableId]);

	const handleCreateTable = useCallback(async () => {
		const table = await actions.createTable();
		setTables((prev) => [...prev, table]);
		setSelectedTableId(table.id);
	}, []);

	const handleDeleteColumn = useCallback(async (columnId: string) => {
		await actions.deleteColumn(columnId);
		setColumns((prev) => prev.filter((c) => c.id !== columnId));
		setCells((prev) => prev.filter((c) => c.column_id !== columnId));
		setDependencies((prev) =>
			prev.filter(
				(d) =>
					d.source_column_id !== columnId &&
					d.target_column_id !== columnId,
			),
		);
	}, []);

	const handleDeleteRow = useCallback(async (rowId: string) => {
		await actions.deleteRow(rowId);
		setRows((prev) => prev.filter((r) => r.id !== rowId));
		setCells((prev) => prev.filter((c) => c.row_id !== rowId));
	}, []);

	// ── Render ────────────────────────────────────────────

	if (loading && tables.length === 0) {
		return (
			<div className="bg-neutral-950 text-neutral-400 min-h-screen flex items-center justify-center font-mono text-sm">
				Loading...
			</div>
		);
	}

	return (
		<div className="bg-neutral-950 text-neutral-100 min-h-screen flex flex-col font-sans">
			{/* Header */}
			<header className="border-b border-neutral-800 px-5 py-3 flex items-center gap-4">
				<h1 className="text-lg font-semibold tracking-tight">
					marble
					<span className="text-neutral-500 font-normal ml-2 text-sm">
						demo
					</span>
				</h1>

				{running && (
					<span className="text-orange-400 text-xs font-mono animate-pulse">
						running programs...
					</span>
				)}

				<div className="ml-auto flex items-center gap-2">
					<select
						className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
						value={selectedTableId ?? ""}
						onChange={(e) => setSelectedTableId(e.target.value)}
					>
						{tables.map((t) => (
							<option key={t.id} value={t.id}>
								Table {shortId(t.id)}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={handleCreateTable}
						className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2.5 py-1 text-sm transition-colors"
					>
						+ Table
					</button>
				</div>
			</header>

			{/* Main */}
			<div className="flex-1 flex min-h-0">
				{/* Grid panel */}
				<div className="flex-1 flex flex-col min-w-0">
					{/* Toolbar */}
					<div className="px-5 py-2.5 flex items-center gap-2 border-b border-neutral-800/50">
						<button
							type="button"
							onClick={handleAddRow}
							disabled={!selectedTableId}
							className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 border border-neutral-700 rounded px-2.5 py-1 text-sm transition-colors"
						>
							+ Row
						</button>
						<button
							type="button"
							onClick={() => setShowAddColumn(true)}
							disabled={!selectedTableId}
							className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 border border-neutral-700 rounded px-2.5 py-1 text-sm transition-colors"
						>
							+ Column
						</button>
						<button
							type="button"
							onClick={handleRunAll}
							disabled={
								!selectedTableId ||
								columns.length === 0 ||
								running
							}
							className="bg-orange-700 hover:bg-orange-600 disabled:opacity-40 border border-orange-600 rounded px-3 py-1 text-sm font-medium transition-colors ml-auto"
						>
							Run All
						</button>
					</div>

					{/* Grid */}
					<div className="flex-1 p-4">
						{selectedTableId ? (
							<div className="h-full">
								<AgGridReact
									ref={gridRef}
									theme={gridTheme}
									columnDefs={colDefs}
									rowData={rowData}
									onCellValueChanged={onCellValueChanged}
									domLayout={
										rowData.length < 20
											? "autoHeight"
											: "normal"
									}
									headerHeight={34}
									rowHeight={32}
									getRowId={(params) =>
										params.data._rowId as string
									}
								/>
							</div>
						) : (
							<div className="text-neutral-500 text-sm flex items-center justify-center h-32">
								Select or create a table to get started.
							</div>
						)}
					</div>

					{/* Column + Row management */}
					{sortedColumns.length > 0 && (
						<div className="border-t border-neutral-800/50 px-5 py-3">
							<h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
								Columns
							</h3>
							<div className="flex flex-wrap gap-2">
								{sortedColumns.map((col) => (
									<div
										key={col.id}
										className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs flex items-center gap-2"
									>
										<span className="text-neutral-400 font-mono">
											{col.index}
										</span>
										<span className="text-neutral-300 truncate max-w-40">
											{col.column_program
												? programLabel(
														col.column_program,
													)
												: "—"}
										</span>
										{isUserInputColumn(col) && (
											<span className="text-orange-500/80 text-[10px]">
												input
											</span>
										)}
										<button
											type="button"
											onClick={() =>
												handleDeleteColumn(col.id)
											}
											className="text-neutral-600 hover:text-red-400 transition-colors ml-1"
										>
											×
										</button>
									</div>
								))}
							</div>
							<h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-3 mb-2">
								Rows
							</h3>
							<div className="flex flex-wrap gap-2">
								{rows.map((row) => (
									<div
										key={row.id}
										className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs flex items-center gap-2"
									>
										<span className="text-neutral-400 font-mono">
											{shortId(row.id)}
										</span>
										<button
											type="button"
											onClick={() =>
												handleDeleteRow(row.id)
											}
											className="text-neutral-600 hover:text-red-400 transition-colors ml-1"
										>
											×
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Run log */}
					{runLog.length > 0 && (
						<div className="border-t border-neutral-800/50 px-5 py-3 max-h-56 overflow-auto">
							<div className="flex items-center justify-between mb-2">
								<h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
									Execution Log
								</h3>
								<button
									type="button"
									onClick={() => setRunLog([])}
									className="text-xs text-neutral-600 hover:text-neutral-400"
								>
									clear
								</button>
							</div>
							<pre className="text-xs font-mono space-y-0.5">
								{runLog.map((line, i) => (
									<div
										key={`${i}-${line.substring(0, 20)}`}
										className={
											line.startsWith("FAIL")
												? "text-red-400"
												: line.startsWith("run")
													? "text-green-400"
													: line.startsWith("keep")
														? "text-blue-400"
														: "text-neutral-500"
										}
									>
										{line}
									</div>
								))}
							</pre>
						</div>
					)}
				</div>

				{/* Programs sidebar */}
				<aside className="w-80 border-l border-neutral-800 flex flex-col bg-neutral-900/40 shrink-0">
					<div className="px-4 py-2.5 border-b border-neutral-800/50 flex items-center justify-between">
						<h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
							Programs
						</h2>
						<button
							type="button"
							onClick={() => {
								setIsNewProgram(true);
								setEditingProgram({
									code: "export default ({ variables }) => {\n  return variables.input;\n}",
									runtime: "JavaScript",
									external_instance_type: "Lite",
									input_schema: {
										variables: {
											input: {
												name: "Input",
												description: "Input value",
											},
										},
									} as unknown as Program["input_schema"],
									output_schema:
										{} as unknown as Program["output_schema"],
									first_party: false,
								} as Program);
							}}
							className="text-xs text-neutral-400 hover:text-orange-400 transition-colors"
						>
							+ New
						</button>
					</div>

					<div className="flex-1 overflow-auto">
						{programs.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => {
									setEditingProgram(p);
									setIsNewProgram(false);
								}}
								className={`w-full text-left px-4 py-2.5 border-b border-neutral-800/30 hover:bg-neutral-800/50 transition-colors ${
									editingProgram?.id === p.id
										? "bg-neutral-800/60"
										: ""
								}`}
							>
								<div className="text-xs font-mono text-neutral-300 truncate">
									{programLabel(p)}
								</div>
								<div className="text-[10px] text-neutral-600 mt-0.5 flex gap-2">
									<span>{p.runtime}</span>
									<span>{p.external_instance_type}</span>
									{p.first_party && <span>1st party</span>}
									<span className="ml-auto">
										{shortId(p.id)}
									</span>
								</div>
							</button>
						))}
						{programs.length === 0 && (
							<div className="text-neutral-600 text-xs px-4 py-6 text-center">
								No programs yet.
							</div>
						)}
					</div>

					{editingProgram && (
						<ProgramEditor
							program={editingProgram}
							isNew={isNewProgram}
							onSave={async (data) => {
								const inputSchema = JSON.parse(
									data.inputSchema,
								);
								const outputSchema = JSON.parse(
									data.outputSchema,
								);
								if (isNewProgram) {
									const created =
										await actions.createProgram({
											code: data.code,
											runtime: data.runtime,
											external_instance_type:
												data.instanceType,
											input_schema: inputSchema,
											output_schema: outputSchema,
										});
									setPrograms((prev) => [...prev, created]);
								} else {
									const updated =
										await actions.updateProgram(
											editingProgram.id,
											{
												code: data.code,
												runtime: data.runtime,
												external_instance_type:
													data.instanceType,
												input_schema: inputSchema,
												output_schema: outputSchema,
											},
										);
									setPrograms((prev) =>
										prev.map((p) =>
											p.id === updated.id ? updated : p,
										),
									);
								}
								setEditingProgram(null);
								setIsNewProgram(false);
							}}
							onDelete={
								isNewProgram
									? undefined
									: async () => {
											await actions.deleteProgram(
												editingProgram.id,
											);
											setPrograms((prev) =>
												prev.filter(
													(p) =>
														p.id !==
														editingProgram.id,
												),
											);
											setEditingProgram(null);
										}
							}
							onCancel={() => {
								setEditingProgram(null);
								setIsNewProgram(false);
							}}
						/>
					)}
				</aside>
			</div>

			{/* Add Column Modal */}
			{showAddColumn && selectedTableId && (
				<AddColumnModal
					programs={programs}
					existingColumns={sortedColumns}
					onSubmit={(programId, template) =>
						actions
							.createColumn({
								table_id: selectedTableId,
								program_id: programId,
								input_values_template: template as Json,
							})
							.then(({ column, cells: newCells }) => {
								setColumns((prev) => [...prev, column]);
								setCells((prev) => [
									...prev,
									...(newCells as Cell[]),
								]);
								setShowAddColumn(false);
							})
					}
					onClose={() => setShowAddColumn(false)}
				/>
			)}
		</div>
	);
}

// ── ProgramEditor ───────────────────────────────────────

type ProgramEditorProps = {
	program: Program;
	isNew: boolean;
	onSave: (data: {
		code: string;
		runtime: "JavaScript" | "Python";
		instanceType:
			| "Lite"
			| "Basic"
			| "Standard1"
			| "Standard2"
			| "Standard3"
			| "Standard4";
		inputSchema: string;
		outputSchema: string;
	}) => void;
	onDelete?: () => void;
	onCancel: () => void;
};

function ProgramEditor({
	program,
	isNew,
	onSave,
	onDelete,
	onCancel,
}: ProgramEditorProps) {
	const [code, setCode] = useState(program.code);
	const [runtime, setRuntime] = useState(program.runtime);
	const [instanceType, setInstanceType] = useState(
		program.external_instance_type,
	);
	const [inputSchema, setInputSchema] = useState(
		JSON.stringify(program.input_schema, null, 2),
	);
	const [outputSchema, setOutputSchema] = useState(
		JSON.stringify(program.output_schema, null, 2),
	);

	useEffect(() => {
		setCode(program.code);
		setRuntime(program.runtime);
		setInstanceType(program.external_instance_type);
		setInputSchema(JSON.stringify(program.input_schema, null, 2));
		setOutputSchema(JSON.stringify(program.output_schema, null, 2));
	}, [program]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		onSave({ code, runtime, instanceType, inputSchema, outputSchema });
	};

	const labelClass = "text-[10px] text-neutral-500 uppercase tracking-wider";
	const inputClass =
		"w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono focus:border-orange-600 focus:outline-none";

	return (
		<form
			onSubmit={handleSubmit}
			className="border-t border-neutral-700 bg-neutral-900/80 flex flex-col max-h-[50vh] overflow-auto"
		>
			<div className="px-4 py-2 border-b border-neutral-800/50 flex items-center justify-between">
				<span className="text-xs text-neutral-400">
					{isNew ? "New Program" : `Edit ${shortId(program.id)}`}
				</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-neutral-600 hover:text-neutral-300 text-lg leading-none"
				>
					×
				</button>
			</div>

			<div className="p-4 space-y-3 flex-1">
				<label className="block">
					<span className={labelClass}>Code</span>
					<textarea
						value={code}
						onChange={(e) => setCode(e.target.value)}
						rows={6}
						className={`${inputClass} resize-y`}
						spellCheck={false}
					/>
				</label>

				<div className="grid grid-cols-2 gap-2">
					<label className="block">
						<span className={labelClass}>Runtime</span>
						<select
							value={runtime}
							onChange={(e) =>
								setRuntime(
									e.target.value as typeof runtime,
								)
							}
							className={inputClass}
						>
							<option value="JavaScript">JavaScript</option>
							<option value="Python">Python</option>
						</select>
					</label>
					<label className="block">
						<span className={labelClass}>Instance</span>
						<select
							value={instanceType}
							onChange={(e) =>
								setInstanceType(
									e.target.value as typeof instanceType,
								)
							}
							className={inputClass}
						>
							{[
								"Lite",
								"Basic",
								"Standard1",
								"Standard2",
								"Standard3",
								"Standard4",
							].map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
					</label>
				</div>

				<label className="block">
					<span className={labelClass}>Input Schema (JSON)</span>
					<textarea
						value={inputSchema}
						onChange={(e) => setInputSchema(e.target.value)}
						rows={4}
						className={`${inputClass} resize-y text-xs`}
						spellCheck={false}
					/>
				</label>

				<label className="block">
					<span className={labelClass}>Output Schema (JSON)</span>
					<textarea
						value={outputSchema}
						onChange={(e) => setOutputSchema(e.target.value)}
						rows={2}
						className={`${inputClass} resize-y text-xs`}
						spellCheck={false}
					/>
				</label>
			</div>

			<div className="px-4 py-2.5 border-t border-neutral-800/50 flex items-center gap-2">
				<button
					type="submit"
					className="bg-orange-700 hover:bg-orange-600 border border-orange-600 rounded px-3 py-1 text-sm font-medium transition-colors"
				>
					{isNew ? "Create" : "Save"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
				>
					Cancel
				</button>
				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="ml-auto text-red-500/60 hover:text-red-400 text-sm transition-colors"
					>
						Delete
					</button>
				)}
			</div>
		</form>
	);
}

// ── AddColumnModal ──────────────────────────────────────

type AddColumnModalProps = {
	programs: Program[];
	existingColumns: Column[];
	onSubmit: (
		programId: string,
		inputValuesTemplate: Record<string, unknown>,
	) => void;
	onClose: () => void;
};

function AddColumnModal({
	programs,
	existingColumns,
	onSubmit,
	onClose,
}: AddColumnModalProps) {
	const [selectedProgramId, setSelectedProgramId] = useState(
		programs[0]?.id ?? "",
	);
	const [variableSources, setVariableSources] = useState<
		Record<string, VariableSourceConfig>
	>({});

	const selectedProgram = programs.find((p) => p.id === selectedProgramId);

	const variables = useMemo(() => {
		if (!selectedProgram) return {};
		const schema = selectedProgram.input_schema as {
			variables?: Record<
				string,
				{
					name: string;
					description: string;
					$marble__use_cell_value?: boolean;
				}
			>;
		};
		return schema?.variables ?? {};
	}, [selectedProgram]);

	useEffect(() => {
		const defaults: Record<string, VariableSourceConfig> = {};
		for (const [key, varDef] of Object.entries(variables)) {
			if (varDef.$marble__use_cell_value) {
				defaults[key] = { source: "cell_value" };
			} else {
				defaults[key] = {
					source:
						existingColumns.length > 0 ? "column" : "literal",
					column_id: existingColumns[0]?.id,
					value: "",
				};
			}
		}
		setVariableSources(defaults);
	}, [variables, existingColumns]);

	const handleCreate = () => {
		const template: Record<string, unknown> = {
			variables: { ...variableSources },
		};
		onSubmit(selectedProgramId, template);
	};

	const updateSource = (
		key: string,
		patch: Partial<VariableSourceConfig>,
	) => {
		setVariableSources((prev) => ({
			...prev,
			[key]: { ...prev[key], ...patch },
		}));
	};

	return (
		<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
			<div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-lg shadow-2xl">
				<div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
					<h3 className="text-sm font-medium">Add Column</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-neutral-500 hover:text-neutral-300 text-lg"
					>
						×
					</button>
				</div>

				<div className="p-5 space-y-4">
					<label className="block">
						<span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
							Program
						</span>
						<select
							value={selectedProgramId}
							onChange={(e) =>
								setSelectedProgramId(e.target.value)
							}
							className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono"
						>
							{programs.map((p) => (
								<option key={p.id} value={p.id}>
									{programLabel(p)}
								</option>
							))}
						</select>
					</label>

					{Object.entries(variables).length > 0 && (
						<div>
							<span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">
								Variable Mapping
							</span>
							<div className="space-y-3">
								{Object.entries(variables).map(
									([key, varDef]) => (
										<div
											key={key}
											className="bg-neutral-800/60 rounded p-3 space-y-2"
										>
											<div className="flex items-baseline gap-2">
												<span className="text-sm font-mono text-orange-400">
													{key}
												</span>
												<span className="text-xs text-neutral-500">
													{varDef.name} &mdash;{" "}
													{varDef.description}
												</span>
											</div>

											<div className="flex gap-2">
												<select
													value={
														variableSources[key]
															?.source ??
														"literal"
													}
													onChange={(e) =>
														updateSource(key, {
															source: e.target
																.value as VariableSourceConfig["source"],
														})
													}
													className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
												>
													<option value="cell_value">
														Cell Value (user input)
													</option>
													<option value="column">
														From Column
													</option>
													<option value="literal">
														Literal
													</option>
												</select>

												{variableSources[key]
													?.source === "column" && (
													<select
														value={
															variableSources[key]
																?.column_id ??
															""
														}
														onChange={(e) =>
															updateSource(key, {
																column_id:
																	e.target
																		.value,
															})
														}
														className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs flex-1"
													>
														{existingColumns.map(
															(col) => (
																<option
																	key={col.id}
																	value={
																		col.id
																	}
																>
																	Col{" "}
																	{col.index}{" "}
																	(
																	{shortId(
																		col.id,
																	)}
																	)
																</option>
															),
														)}
													</select>
												)}

												{variableSources[key]
													?.source === "literal" && (
													<input
														type="text"
														value={
															variableSources[key]
																?.value ?? ""
														}
														onChange={(e) =>
															updateSource(key, {
																value: e.target
																	.value,
															})
														}
														placeholder="Literal value"
														className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs flex-1"
													/>
												)}
											</div>
										</div>
									),
								)}
							</div>
						</div>
					)}
				</div>

				<div className="px-5 py-3 border-t border-neutral-800 flex items-center gap-2 justify-end">
					<button
						type="button"
						onClick={onClose}
						className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!selectedProgramId}
						className="bg-orange-700 hover:bg-orange-600 disabled:opacity-40 border border-orange-600 rounded px-3 py-1 text-sm font-medium transition-colors"
					>
						Create Column
					</button>
				</div>
			</div>
		</div>
	);
}
