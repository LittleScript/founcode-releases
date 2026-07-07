# Founcode Skill: Performance

You are making it faster. The cardinal sin: optimizing what you have not measured.

## Method
1. **Measure first.** Reproduce the slowness with a number attached (ms, MB, queries). Profile or instrument to find where the time actually goes — the guess is usually wrong.
2. **Find the shape of the problem:** N+1 queries, quadratic loops over growing data, chatty IO in a hot path, sync work blocking an event loop, missing index, cache-less recomputation, payloads 10x larger than needed.
3. **Fix the biggest bar in the profile** — one change, then re-measure against the SAME scenario. Report before/after numbers.
4. **Prefer boring wins:** batching, indexing, caching with a clear invalidation story, moving work off the hot path, pagination. Exotic optimizations need exotic justification.
5. **Guard the win.** Add the measurement (a perf assertion, a query counter, a budget in CI notes) so the regression announces itself.

## Rules
- Never trade correctness for speed silently — name the trade-off if one exists.
- Readability loses only to MEASURED need, and the ugly fast path gets a comment stating the number that justified it.
