# Apollo Enrichment Recipe Plan

## Status

- State: not implemented
- Intent: capture a future recipe-style UX without committing it to the current Marble product surface
- Scope: an opinionated helper for provisioning an Apollo person enrichment workflow using existing Marble resources

## Why This Is A Doc Instead Of A Feature

The current Marble model is already expressive enough for an external agent to create this workflow from scratch:

- `secret`
- `program`
- `program_secret_binding`
- `table`
- `column`
- `source`
- `pipe`

What is missing is not ontology. What is missing is convenience, discoverability, and a stable opinionated contract for how an agent should assemble those pieces. This document preserves that design without prematurely hardening it into product surface area.

## Target Outcome

Given:

- a Marble `project`
- an Apollo API key
- a desire to enrich people using Apollo's People Match API

Produce:

- a Marble secret holding the Apollo API key
- a Marble program that calls Apollo People Match
- a program-level secret binding exposing `APOLLO_API_KEY`
- a table with dedicated source/input columns
- a downstream enrichment column wired through `inputTemplate`
- a source with a payload schema suitable for webhook ingestion
- a pipe mapping source payload fields into the input columns

The resulting workflow should support both:

- manual/table-entry driven execution
- source/pipe-driven execution

## Current Manual Assembly Flow

An external agent can already do this today using the existing API or CLI:

1. Find or create a Marble secret named `APOLLO_API_KEY`.
2. Upsert a program whose manifest declares a required secret env named `APOLLO_API_KEY`.
3. Bind that program env to the Marble secret.
4. Create a table.
5. Create dedicated input columns using the `User Input` program.
6. Create an Apollo enrichment column whose `inputTemplate` references those input columns.
7. Create a source with a payload schema.
8. Create a pipe whose mappings write into the input columns.
9. Ingest payloads or edit table cells and let normal run execution populate downstream results.

## What Was Missing For An Agent

Within the existing model, the practical gaps were:

- No single canonical workflow description for how to assemble the resources.
- No human-friendly secret commands in the CLI.
- No human-friendly program/column secret-binding commands in the CLI.
- No agreed Apollo program template or input schema contract.
- No agreed source payload schema or pipe mapping contract.
- No agreed idempotency story for rerunning the setup.
- No explicit operator guidance around when downstream runs become eligible.

None of those require a new top-level Marble concept.

## Proposed Future UX

### CLI Shape

Candidate command:

```sh
bunx marble-cli recipe apollo-person-enrichment --project <projectId> --api-key-env APOLLO_API_KEY
```

This should remain explicitly opinionated. It is not a generic workflow generator.

### Inputs

- `--project <projectId>`: required
- `--table-name <name>`: optional
- `--source-name <name>`: optional
- `--program-name <name>`: optional
- `--secret-name <name>`: optional, default `APOLLO_API_KEY`
- `--api-key-env <envName>` or `--api-key-value <value>`: optional if the secret already exists

### Outputs

The command should print machine-readable JSON:

- `table.id`
- `program.id`
- `programVersion.id`
- `secret.id`
- `source.id`
- `source.webhookToken`
- `source.webhookUrl` when the local environment knows the ingestor base URL
- `pipe.id`
- created column IDs keyed by semantic purpose

### Provisioned Resource Graph

Expected columns:

- `Person Name`
- `Company Name`
- `Company Domain`
- `Work Email`
- `LinkedIn URL`
- `Apollo Match`

Expected enrichment `inputTemplate`:

- `name` from `Person Name`
- `organizationName` from `Company Name`
- `domain` from `Company Domain`
- `email` from `Work Email`
- `linkedinUrl` from `LinkedIn URL`

Expected source payload contract:

- `personName`
- `companyName`
- `companyDomain`
- `email`
- `linkedinUrl`

Expected pipe mappings:

- `$.personName` -> `Person Name`
- `$.companyName` -> `Company Name`
- `$.companyDomain` -> `Company Domain`
- `$.email` -> `Work Email`
- `$.linkedinUrl` -> `LinkedIn URL`

## Secret Behavior

The future recipe should:

1. Look for an existing Marble secret with the requested name.
2. Reuse it if found.
3. Otherwise create it from the supplied env var or plaintext flag.
4. Bind the program env `APOLLO_API_KEY` to that Marble secret.

Deliberately avoid:

- rotating an existing secret silently
- mutating a secret value without an explicit flag
- creating duplicate secrets with slightly different names

## Program Contract

The future recipe should provision a program that:

- calls `POST https://api.apollo.io/api/v1/people/match`
- authenticates with `X-Api-Key`
- accepts at least:
  - `email`
  - `linkedinUrl`
  - `name + organizationName`
  - `name + domain`
- returns the raw Apollo payload, not a Marble-specific normalized summary

That keeps the setup helper thin and avoids prematurely designing a Marble-side Apollo abstraction.

## Idempotency Rules

The future recipe must be safe to rerun.

Recommended behavior:

- Reuse the secret by exact name.
- Reuse the program by exact name and upsert a new version.
- Create the table only if it does not already exist by exact name within the target project, or require an explicit `--reuse-table`.
- Refuse to guess when multiple matching tables or programs exist.
- Refuse to overwrite pipe mappings without an explicit confirmation flag.

## Failure Handling

The future recipe should fail early on:

- missing or invalid project ID
- missing Apollo API key when no existing secret is available
- inability to find the `User Input` program when that remains the chosen input primitive
- invalid program schema or invalid `inputTemplate`
- inability to create the source or pipe

It should not leave partial opaque output. If provisioning succeeds partially, the JSON response should still enumerate what was created before failure.

## Relationship To Auto-Run Behavior

This recipe does not replace execution semantics.

It depends on the existing Marble behavior that:

- source ingress writes to input cells
- source/input cells execute
- downstream cells become eligible when their resolved `inputTemplate` validates against the target program input schema

That means the recipe is only worthwhile if automatic dependent execution exists and stays reliable.

## Non-Goals

- Apollo-specific first-class resource types
- Apollo-specific normalized result schema in Marble core
- hidden magical secret storage outside the existing `secret` model
- bespoke per-provider pipeline entities
- replacing the underlying manual assembly path

## Recommended Prerequisites Before Implementation

- settle the product stance on opinionated setup helpers
- settle whether recipes belong in the CLI, the web app, or a separate agent layer
- settle idempotency behavior around preexisting tables/programs/secrets
- settle whether paid-provider columns need explicit trigger policies before a recipe makes them too easy to create
