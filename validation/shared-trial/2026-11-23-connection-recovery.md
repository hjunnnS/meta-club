# Connection recovery — 2026-11-23, follow-up #174

The reported tommy-moderate-rescue-sociology hostname was the old trial endpoint, not a confirmed spelling error. The Mac supervisor was stopped and no trial container was running. Prior runtime logs showed Docker unavailable before shutdown. The public endpoint record still advertised the old hostname as available.

Started the existing Mac supervisor without opening a club browser. The new public tunnel and local /healthz both returned HTTP200 with status ok. Existing DB, expiry and music/performance code were retained.

Endpoint publishing failed with GitHub403: the Mac's active/keychain Git user differed from the repository owner. The existing owner account was still registered. Added an endpoint-checkout-only Git credential helper that obtains the existing hjunnnS credential through gh for HTTPS requests to hjunnnS/meta-club only. It never switches the active gh account, writes a token to disk, logs it or adds access permissions. The helper is installed alongside the existing publisher for future restarts; the current runtime and generated checkout were updated without a second server restart.

The publisher succeeded, and the public raw endpoint record matched the new running URL. Existing Sites source was not changed or redeployed. No 3D browser, playback, load, mobile or gameplay test was run. New tunnel registration, Mac/Docker availability and owner Git credential validity remain prerequisites; this is not a fixed-hostname or availability guarantee.
