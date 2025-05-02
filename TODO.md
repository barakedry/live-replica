# TypeScript Migration Plan

## Goals

- Migrate all packages to native TypeScript (`.ts`/`.tsx`), removing all `.js` sources.
- Eliminate manually-defined `.d.ts` files in favor of native TypeScript types.
- Ensure all packages build and type-check correctly.
- Maintain or improve test coverage, migrating tests to TypeScript as well.
- Preserve monorepo structure and package boundaries.

---

## 1. Preparation

- [ ] Ensure all dependencies are up to date and compatible with TypeScript.
- [ ] Add TypeScript as a devDependency at the root and in each package as needed.
- [ ] Add or update `tsconfig.json` in each package (and root if needed) for project references.
- [ ] Keep existing `.d.ts` files for now, as they may be necessary during the JS to TS migration. Plan to remove them only after the migration is complete and all types are natively defined in TypeScript.

---

## 2. Package-by-Package Migration

For each package in `packages/`:

- [ ] Rename `.js`/`.jsx` files to `.ts`/`.tsx`.
- [ ] Convert code to valid TypeScript:
  - Add type annotations and interfaces.
  - Replace `require`/`module.exports` with `import`/`export`.
  - Remove JSDoc type comments in favor of TypeScript types.
- [ ] Remove any corresponding `.d.ts` files.
- [ ] Update `package.json`:
  - Set `"types"` field to the output `.d.ts` (auto-generated).
  - Adjust build scripts to use `tsc`.
- [ ] Add or update `tsconfig.json`:
  - Use `composite: true` for project references.
  - Reference other packages as needed.
- [ ] Update or add type-aware build scripts.

---

## 3. Shared Types

- [ ] Move all shared types/interfaces to a `types` package as native `.ts` files.
- [ ] Remove `index.d.ts` and replace with `index.ts`.
- [ ] Update all imports in other packages to use the new TypeScript types.

---

## 4. Tests

- [ ] Rename test files from `.js` to `.ts`.
- [ ] Update test runner config (e.g., Jest) to support TypeScript.
- [ ] Refactor tests to use TypeScript types and imports.

---

## 5. Lerna/Monorepo Integration

- [ ] Ensure all `tsconfig.json` files use project references for inter-package dependencies.
- [ ] Update root `tsconfig.json` to reference all packages.
- [ ] Ensure Lerna build/test scripts work with TypeScript.

---

## 6. Build & CI

- [ ] Update build scripts to use `tsc --build` for all packages.
- [ ] Ensure type-checking and builds pass in CI.
- [ ] Remove Babel if only used for transpiling JS to JS (optional, if not needed for other reasons).

---

## 7. Cleanup

- [ ] Remove all `.js` source files after migration.
- [ ] Remove all manually-defined `.d.ts` files.
- [ ] Remove any unused dependencies.

---

## 8. Documentation

- [ ] Update `README.md` and other docs to reflect TypeScript usage.
- [ ] Document how to add new packages in TypeScript.

---

## 9. Final Checks

- [ ] Ensure all packages build and type-check independently and together.
- [ ] Ensure all tests pass.
- [ ] Tag and release the new TypeScript version. 