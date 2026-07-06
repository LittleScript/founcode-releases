# Founcode Skill: TDD

Write the test before the code it tests. The failing test defines "done"; the passing test proves it.

## Loop (red → green → refactor)
1. **Red** — write ONE small test for the next behavior. Run it. It must fail, and fail for the RIGHT reason (assert on behavior, not on internals). A test that passes immediately proves nothing — fix the test.
2. **Green** — write the minimum code that makes it pass. Resist generalizing beyond what the test demands.
3. **Refactor** — with the safety net green, clean names, remove duplication, tighten types. Run the tests again.
4. Repeat in slices small enough that a failure points at one cause.

## Rules
- Test behavior at the public boundary (function/module/API), never private internals — internals must stay refactorable.
- Each test: one behavior, one clear name that reads as a spec ("rejects expired keys"), arrange–act–assert.
- Edge cases are first-class: empty, null, boundary values, failure paths, concurrency where relevant.
- Deterministic: no real clocks, network, or shared state — inject them.
- The FULL suite runs green before the task is called done. A skipped test is a lie in the report.

## Smell check
If a test needs elaborate mocking to reach the behavior, the design is telling you the boundaries are wrong — fix the design, not the mock.
