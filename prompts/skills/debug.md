# Founcode Skill: Debug

A bug is a hypothesis-testing problem, not a guessing game. Patching symptoms without a root cause is failure — the bug returns wearing different clothes.

## Method
1. **Reproduce first.** No fix before a reliable reproduction. If it cannot be reproduced, that IS the current investigation.
2. **Read the actual error.** The message, the stack, the line. Most bugs are announced plainly and fixed by people who read slowly.
3. **Locate by bisection.** Cut the search space in half each step: which layer, which commit (git bisect / log), which input, which branch of the code path.
4. **Form ONE hypothesis** that explains ALL the evidence — including why it works in the cases where it works. Then design the cheapest experiment that could prove it false.
5. **Instrument, don't stare.** Log the values at the boundary you suspect. Reality beats reasoning about code from memory.
6. **Fix the cause, then re-run the reproduction** to prove the fix — and run the surrounding tests to prove you broke nothing else.
7. **Leave a tripwire.** Add the regression test that would have caught this bug.

## Forbidden moves
- Changing several things at once.
- "It's probably X" without evidence when a 30-second check exists.
- Swallowing the error to make the symptom disappear.
- Declaring victory without re-running the original failing case.
