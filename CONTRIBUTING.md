# Contributing to ENSCON Trip

Thanks for your interest in contributing! Please read these guidelines before opening a pull request.

## Ground Rules

1. **Open an issue first** — Before writing any code, describe your idea in an [issue](https://github.com/JoeyVIP/enscon-trip/issues/new). We'll let you know if the PR is wanted and give direction. PRs that show up without prior discussion will be closed
2. **One change per PR** — Keep it focused. Don't bundle unrelated fixes or refactors
3. **No breaking changes** — Backwards compatibility is non-negotiable
4. **Target the `main` branch** — All PRs are opened against `main` (this fork has no separate `dev` flow). Note: this is a fork of TREK; changes that belong upstream should go to the [upstream project](https://github.com/liketrek/TREK)
5. **Match the existing style** — No reformatting, no linter config changes, no "while I'm here" cleanups
6. **Tests** — Your changes must include tests. The project maintains 80%+ coverage; PRs that drop it will be closed
7. **Branch up to date** — Your branch must be up to date with `main` before submitting a PR

## Pull Requests

### Your PR should include:

- **Summary** — What does this change and why? (1-3 bullet points)
- **Test plan** — How did you verify it works?
- **Linked issue** — Reference the issue (e.g. `Fixes #123`)

### Your PR will be closed if it:

- Wasn't discussed and approved in an issue first
- Introduces breaking changes
- Adds unnecessary complexity or features beyond scope
- Reformats or refactors unrelated code
- Adds dependencies without clear justification

### Commit messages

Use [conventional commits](https://www.conventionalcommits.org/):

```
fix(maps): correct zoom level on Safari
feat(budget): add CSV export for expenses
```

## Development Environment

See the [Developer Environment page](https://github.com/liketrek/TREK/wiki/Development-environment) for more information on setting up your development environment.

## More Details

See the [Contributing wiki page](https://github.com/liketrek/TREK/wiki/Contributing) for the full tech stack, architecture overview, and detailed guidelines.
