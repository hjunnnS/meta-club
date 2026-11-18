# EDM follow-up — 2026-11-18

## Existing Milestone / Epic / Implementation ownership
- G4 / Epic #3 / #174: keep Mac-owned Colyseus, free temporary public tunnel, URL-only entry. Stable Sites landing resolves the current public origin from the repository's dedicated `trial-endpoint` branch. The supervisor publishes only URL/availability/expiry/update time after server readiness; retries on failure. Existing Mac Git authentication is reused without embedding credentials. Startup/shutdown and temporary-host changes remain dependent on Mac, Docker, internet and GitHub availability. No paid hosting or fixed tunnel guarantee.
- G4 / Epic #7 / #176: matching-game implementation is present. Prior isolated server-client rule checks are not a three-browser UI pass. UI verification was interrupted for heat and is still pending. No new game behavior is required based on current evidence.
- G4 / #147 and #142: latest table-aisle route, hardware-scaled picking and walking smoothing are deployed. Their actual-scene regression check is still pending. No claim of a new browser pass.
- G1 / Epic #1 / #23: persist validated cosmetic appearance by existing authenticated account ID in SQLite `avatar_style`; restore on room join; save null for default appearance. Existing profile nickname/avatar persistence retained. Send success only after DB write; retain old actor appearance on failure. Browser UUID trial identities restore only while that identity is retained. Real Google/Apple identity, cross-device sign-in and mobile validation stay deferred; no anonymous cross-device identity sharing added.

## Integration and verification boundary
Merge PR #173 then retarget/merge #175 into main after saving this change. Preserve all policy and previous test history. Close desktop implementation issues only where the approved implementation is already delivered; do not close #23, #142, #147, #174 or #176 merely because code is merged. Old five-song request #139 was superseded by the approved Neon Horizon choice.

Only source inspection, JS syntax validation and deployment readiness/metadata inspection in this run. No browser rendering, music playback, multiplayer game run, soak/load or mobile tests. Existing music, dance choreography, performances and map geometry are unchanged by this follow-up. Prices/payment and service sound-rights evidence remain deferred.

## Observed completion
- Sites v95 deployment succeeded; stable entry URL retains its public audience.
- After restarting the final supervisor, its automatically published endpoint matched the current runtime URL and `/healthz` returned 200/ok. No 3D browser was opened.
- Closed approved desktop implementation #158, #160, #161, #162, #163, #164, #165, #168, #169, #170. Closed superseded #139 as not_planned. Preserved original body/approval/test history and deferred commercial conditions.
- Updated #23, #142, #147, #174, #176 with exact remaining conditions; they remain open.
- Main merge of PR #173 was rejected by automatic approval review: it reported no explicit authorization for that PR in the current conversation. Did not bypass the rejection. PR #173 and dependent #175 remain open; no main merge was performed. Existing approved work and deployment were completed independently.
