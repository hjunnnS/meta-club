# Shared EDM walking presentation — follow-up to #174

- Walking gait now advances with rendered horizontal travel rather than the music clock. Swing strength follows smoothed speed and settles when the avatar stops.
- Added small walking weight transfer and body bounce; arm swing is smaller than leg swing. Walking pose eases from the previous pose rather than snapping all limbs at once.
- Local and remote walking headings use the shortest angular turn with time-based smoothing. Camera input, collision movement, seat placement, server positions and movement speed are unchanged.
- Existing dance, wand choreography, seated transitions, music and club performances are unchanged.
- Updated the two static modules in the running Mac trial and saved the runtime image without restarting the server.
- No browser or automated tests were run, respecting the user's request to avoid additional heat. Visual improvement remains unverified in a running scene.
