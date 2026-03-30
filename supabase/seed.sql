-- Programs

INSERT INTO column_program (id, runtime, external_instance_type, code, input_schema, output_schema, first_party) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'JavaScript', 'Lite',
   'export default ({ variables }) => variables.value',
   '{"variables": {"value": {"name": "Value", "description": "Raw user input", "$marble__use_cell_value": true}}}',
   '{}',
   true),
  ('00000000-0000-0000-0000-000000000002',
   'JavaScript', 'Lite',
   'export default ({ variables }) => variables.input.toUpperCase()',
   '{"variables": {"input": {"name": "Input text", "description": "Text to transform"}}}',
   '{}',
   true);

-- Table + row

INSERT INTO "table" (id) VALUES
  ('00000000-0000-0000-0001-000000000001');

INSERT INTO "row" (id, table_id, "index") VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 0);

-- Columns: col 1 = user input, col 2 = transforms col 1

INSERT INTO "column" (id, table_id, "index", program_id, input_values_template) VALUES
  ('00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0001-000000000001', 0,
   '00000000-0000-0000-0000-000000000001',
   '{"variables": {"value": {"source": "cell_value"}}}'),
  ('00000000-0000-0000-0002-000000000002',
   '00000000-0000-0000-0001-000000000001', 1,
   '00000000-0000-0000-0000-000000000002',
   '{"variables": {"input": {"source": "column", "column_id": "00000000-0000-0000-0002-000000000001"}}}');

-- Dependency: col 2 depends on col 1

INSERT INTO column_dependency (source_column_id, target_column_id) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0002-000000000002');

-- Cells

INSERT INTO cell (id, column_id, row_id, value) VALUES
  ('00000000-0000-0000-0004-000000000001',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   '"hello world"'),
  ('00000000-0000-0000-0004-000000000002',
   '00000000-0000-0000-0002-000000000002',
   '00000000-0000-0000-0003-000000000001',
   null);
