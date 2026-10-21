# Browser build update, 2026-10-21

The user supplied a screenshot of the earlier procedural Rail Rush menu ("THE SEASIDE SPRINT", block character). The active local production server's bundle already imported the recovered renderer. The exact address of the supplied screenshot was not available, so its origin could not be confirmed.

The service worker previously preferred cached HTML even when the server had a newer build. Navigation now checks the network first and saves the current entry page, with cached fallback on network errors or server failure. Asset lookup is limited to the active release's cache. Registration bypasses HTTP worker caching and requests an update; a page already controlled by a worker reloads once when a new worker takes control. The packaged Python server makes HTML and worker responses revalidate.

A separate server on http://127.0.0.1:8175/ provides a fresh origin for this continuation. Brave visibly displayed the recovered Jake and Ireland environment at that address. This does not establish that the page in the user's supplied screenshot has refreshed.

Validation: 24 Node tests passed, including three navigation/cache regressions; TypeScript and the production build passed. The Chrome regression deliberately replaced cached entry HTML with an old Rail Rush shell, verified an online reload replaced it with the recovered renderer (24 Jake clips), then verified offline reload and gameplay. No page errors were reported in the passing run. An initial Chrome run timed out during initial loading; a diagnostic rerun passed. Report and screenshots: `outputs/web/cache-update/`.

This fixes delivery/update behavior. Gameplay fidelity limitations in `docs/fidelity-differences.md` still apply.
