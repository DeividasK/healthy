# Changelog fragments

Every branch that changes what users get adds one fragment here: a Markdown
file named after the branch (e.g. `96-add-changelog-pattern.md`), so branches
never edit the same file. `pnpm release:prepare <bump>` compiles them into
[`CHANGELOG.md`](../CHANGELOG.md) and deletes them.

```md
---
type: added
---

Group treatments taken together into a bundle and answer them in the journal with one tap.
```

- `type` is one of `added`, `changed`, `fixed`, `removed` or `security`.
- The body is one changelog entry, or one entry per `- ` line. Write for the
  people using the app: what they can now do or what works better, not how it
  was built. No issue numbers, file names or internal terms.
- A branch with changes of different types adds one fragment per type
  (`96-add-changelog-pattern-fixed.md`).
- A change users would not notice (refactors, tests, tooling, dependency
  bumps) needs no fragment. If CI asks for one anyway, add a
  `Changelog: none` trailer to a commit message on the branch.
