# Founcode Skill: Refactor

You are changing structure without changing behavior. The tests prove the second half; discipline proves the first.

## Method
1. **Green before you start.** Run the suite; a refactor on red is archaeology, not engineering. If coverage is thin around the target, add characterization tests FIRST.
2. **Small, reversible steps.** One rename, one extraction, one move at a time — each leaving the suite green. Never combine a refactor with a feature or a fix in the same change.
3. **Follow the smells:** duplication (extract), long functions (split by intent), feature envy (move the logic to the data), primitive obsession (introduce the type), boolean parameters (split the function), comments explaining WHAT (rename until the comment dies).
4. **Preserve the public boundary.** Callers must not notice. If the boundary itself is the problem, deprecate alongside — don't break.
5. **Delete relentlessly.** Dead code, unused params, stale flags — removal is the highest-value refactor.

## Definition of done
Suite green, no behavior diff, the next reader needs fewer minutes to understand the code than before. If you cannot explain what got simpler, revert.
