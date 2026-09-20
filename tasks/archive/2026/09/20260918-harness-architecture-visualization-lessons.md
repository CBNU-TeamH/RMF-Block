# Harness architecture visualization — lessons

**Created**: 2026-09-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The harness is not one linear pipeline: local git hooks, optional AI review skills, container checks, and GitHub checks overlap but have different enforcement strength.
- A topology-valid 2,438px-wide diagram still failed the standalone viewer's desktop readability gate; a three-row 1,330px viewBox preserved detail at 1440px.

## What we would do differently

- Treat the existing Mermaid draft as a layout seed only; validate every policy claim against the current committed files before diagramming it.
- Budget width for the viewer's side panels before settling on a long left-to-right harness spine.

## Worth extracting

- None. The width lesson is specific to Archify artifact authoring rather than this repository's product or coding conventions.
