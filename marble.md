# Marble

In Marble, every column is a computer program, and every cell's value is the result of its column's computer program running in a sandboxed environment.

## The lifecycle of a Marble table

Marble's tabular workflow should be familiar to anyone who has used an action-based spreadsheet program such as Airtable or Clay. You set up a table to represent a specific outcome or task that you're performing on a dataset. Marble allows data to be provided from many datasources, such as CSVs, webhooks, and integrations with services such as Notion, Linear, and Attio. However, for this lifecycle example we're going to focus on the case of manually entering data into a specific cell, or group of cells.

If a table in Marble mostly constitutes a single workflow, then each column within a Marble table constitutes a "step" in that workflow. The name for these columnnar workflow steps in Marble is just "program" since that is quite literally what our columns represent.

Each column must be defined as a program that runs in either JavaScript or Python. Right now, only JavaScript is supported, and code runs on CloudFlare's Workers Sandbox processes. Columns can reference data in other columns, which is fundamentally how a Marble workflow is glued together. The conduit for this data is an input schema, which must be defined for every column, as data structures in Marble are placed against hard constraints where possible. The input schema results in the shape for a base "variables" object (which is just a single-level record of string values) which gets passed to each program execution. An output schema for a column must also be provided to control and validate the output of a program for a cell.

For the sake of simplicity, even rudiemtnary columnar steps such as user input are ultimately passed through a programmatic workflow. Marble ships with proprietary column helpers, such as a plain user input column, but you can write your own Marble column to do practically anything you want. This means that column programs are _the only_ and _first class_ systems in existence in the Marble codebase that allow for cells' values to change.

## Example: Email enrichment + sequencing

Programs required:

1. User input (1st Party)
2. Apollo: Enrich email
3. Apollo: Add to outbound sequence

Columns used:

1. First name [User input]
2. Last name [User input]
3. Company name [User input]
4. Email [Apollo: Enrich email]
5. Send to sequence [Apollo: Add to oudbound sequence]

### Program definition: User input

#### Input schema

```json
{
  "variables": {
    "input": {
      "name": "User input",
      "description": "A plaintext user input value created by manually interacting with a cell in the UI",
      "type": "UserInput"
    }
  }
}
```

#### Output schema

```json
{
  "type": "text"
}
```

Okay so how about... The input to a program isn't really a list of "variables" -- it is a _subset_ of JSON schema. Right now we'll just have a JSON schema input field for the program. And then on the column definition, an input JSON value.

we can later decide how to restrict the JSON schema subset so that it is always interpretable into UI form fields.

As for the output "schema". Tbh I think this should also be a self elected JSON schema again. Maybe too much of a headache? But
