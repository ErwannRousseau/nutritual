# Server agent instructions

## Tests

- Keep unit tests beside the exact source module they test and use the same basename, for example `routes/phone.ts` and `routes/phone.test.ts`.
- Unit tests must call that module's exported functions directly. Do not register multiple application modules in Hono, combine real module implementations with fake databases, or test a whole request flow in a unit test.
- Put business-rule tests in the matching application-operations module's test file, and persistence tests in the matching store module's test file. Stub neighboring dependencies at the module boundary.
- Do not add integration tests. If a proposed test needs multiple production modules wired together, test each module's contract in its own suite instead.
