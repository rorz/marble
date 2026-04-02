WITH

-- Programs: identity pass-through + uppercase transform

inserted_programs AS (
  INSERT INTO program (runtime, code, input_payload_schema, output_value_schema, first_party)
  VALUES
    ('JavaScript',
     'export default ({ input }) => input.value',
     '{"type": "object", "properties": {"value": {"type": "string", "description": "Raw user input value"}}}',
     '{"flags": {"allowManualInput": true}, "schema": {"type": "string"}}',
     true),
    ('JavaScript',
     'export default ({ input }) => input.text.toUpperCase()',
     '{"type": "object", "properties": {"text": {"type": "string", "description": "Text to transform"}}}',
     '{"flags": {}, "schema": {"type": "string"}}',
     true)
  RETURNING id, code
),

program_identity AS (
  SELECT id FROM inserted_programs WHERE code LIKE '%input.value' LIMIT 1
),
program_uppercase AS (
  SELECT id FROM inserted_programs WHERE code LIKE '%toUpperCase()' LIMIT 1
),

-- Table

inserted_table AS (
  INSERT INTO "table" DEFAULT VALUES
  RETURNING id
),

-- Row

inserted_row AS (
  INSERT INTO "row" (table_id, "index")
  SELECT id, 0 FROM inserted_table
  RETURNING id
),

-- Columns: col 1 = user input, col 2 = transforms col 1

inserted_col1 AS (
  INSERT INTO "column" (table_id, "index", program_id, input_template)
  SELECT
    t.id,
    0,
    p.id,
    '{"value.$": "$.cell.manualInputValue"}'
  FROM inserted_table t, program_identity p
  RETURNING id
),

inserted_col2 AS (
  INSERT INTO "column" (table_id, "index", program_id, input_template)
  SELECT
    t.id,
    1,
    p.id,
    '{"text.$": "$.columns.' || c1.id || '.value"}'
  FROM inserted_table t, program_uppercase p, inserted_col1 c1
  RETURNING id
),

-- Dependency: col 2 depends on col 1

_dep AS (
  INSERT INTO column_dependency (source_column_id, target_column_id)
  SELECT c1.id, c2.id
  FROM inserted_col1 c1, inserted_col2 c2
),

-- Cells

_cell1 AS (
  INSERT INTO cell (column_id, row_id, manual_input)
  SELECT c1.id, r.id, 'hello world'
  FROM inserted_col1 c1, inserted_row r
),

_cell2 AS (
  INSERT INTO cell (column_id, row_id)
  SELECT c2.id, r.id
  FROM inserted_col2 c2, inserted_row r
)

SELECT 1;

-- Realtime: publish cell changes so the demo page can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE cell;

-- Permissive SELECT policy so the anon key can receive realtime events
CREATE POLICY "allow_select_cells" ON cell FOR SELECT USING (true);
