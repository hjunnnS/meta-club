# Table approach correction — follow-up to #176

- Scope: click targeting and the ground-table walking approach only.
- Correct destination picking for Babylon hardware scaling, matching the existing character picker. Hover and click now use the same coordinates.
- Route ground-table approaches through x=14.8, inside the return-stair footprint, before turning toward the selected seat exit. Each leg retains the existing collision and zone-permission checks; no teleport or gate bypass is introduced.
- Upper-lounge routes, seat ownership, sitting/standing animation, music and performance rendering are unchanged.
- Published the changed scene module to the running Mac shared trial and saved the runtime image for subsequent server restarts. No server restart was required.
- At the user's request due to heat, no browser, automated, multiplayer or performance test was run. Three-browser game verification remains incomplete; this change is not a test pass.
