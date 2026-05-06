<div align="center">
  <img src="/apps/web/public/logo-big.png" width="200" alt="Marble logo" />

  <h1>Marble</h1>

  <p>
    <strong>Fast, reliable, source-available GTM tooling for humans and agents alike.</strong>
  </p>
</div>

> [!WARNING]
> Marble is under active development and is _not ready for prime time_ just yet.

Marble is an agentic tabulation layer for work that needs a data grid and a set of programmable or remote workflow steps.

## Technology

Marble is designed to be completely self-hostable in a container, or available through a (future) hosted offering.

Marble leverages Cloudflare Workers and Workers Sandboxes to run each cell in its data grid as its own program instance. "Every cell is a program invocation" is the guiding principle of the product.

Supabase is used as the backend layer for Postgres and Auth, and Next.js is used as the general-purpose monolithic frontend with API glue.

## License

Marble is currently available under the Elastic License 2.0. The maintainers
intend to relicense the project under the MIT License in the future.

Contributions are accepted under the terms in CLA.md so that the future MIT
relicensing path remains available.
