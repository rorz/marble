> [!WARNING]
> Marble is under active development, and is _not ready for Primetime_ just yet!

# Marble

Fast, reliable, source-available GTM tooling for humans and agents alike.

Marble is a groundbreaking tool that aims to become the agentic tabulation layer for: any task that requires a data grid and a number of (programatic or remote) workflow steps.

### Technology

Marble is designed to be completely self-hostable in a container, or available through a (future) hosted offering.

Marble leverages CloudFlare Workers and Workers Sandboxes in order to run each cell in its data grid as its own program instance. "Every cell is a program invocation" is the guiding principle of the product.

Supabase is used as a backend layer for Postgres and Auth, and Next.js is used as a general purpose monolithic frontend w/ API glue.

## License

Marble is currently available under the Elastic License 2.0. The maintainers
intend to relicense the project under the MIT License in the future.

Contributions are accepted under the terms in CLA.md so that the future MIT
relicensing path remains available.
