# Afield recommendation preview: deployment handoff
Status: PREVIEW CODE ONLY, NOT A VERIFIED LIVE WEBSITE.

## Existing code
- Branch: `feature/recommendation-actions-v1`
- Preview: `preview/recommendation-actions.html`
- Action module: `recommendation-actions-v1.js`
- Unit tests: `tests/recommendation-actions-v1.test.cjs`

## Safety
- Do not alter `main/index.html`, `main/app-core.html`, production API or user data.
- Do not switch the GitHub Pages source of the existing Paris-2026 repository; it may host the live app.
- Do not deploy this preview in place of the production app.
- The preview uses sample places and assumes demo verification. It is NOT an actual places validation integration.

## How to deploy safely
Use an isolated staging site/project, e.g. separate Cloudflare Pages project (with unique staging hostname). Connect GitHub and select branch `feature/recommendation-actions-v1` and repository root as output; static site without a build step. Then visit `/preview/recommendation-actions.html`.
An alternative is a separate preview-only GitHub Pages repository, not the existing production Pages source.
Only share a URL after it is verified from mobile Safari.

## QA acceptance
1. In Explore tab, primary CTA says "여행 후보에 추가".
2. In fill-slot tab, primary CTA says "이 시간에 추가".
3. Candidate addition does not schedule a place.
4. Schedule action allows selection of a date, with explicit confirmation.
5. Undo restores exactly one previous state.
6. Duplicate submissions are blocked.
7. Operating itinerary and browser persistence are not touched.
8. Demo data, fake verification and missing real recommendation API are disclosed.

## Next integration
Map candidate actions to existing trip state cautiously. Review distinction between `trip.saved` and `recommendationCandidates` before choosing a unified storage schema. Require actual opening hours, location, and constraints validation before scheduling.
