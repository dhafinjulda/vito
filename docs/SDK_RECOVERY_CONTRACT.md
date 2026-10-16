# Startup and recovery contract

Current local contract, 15 October 2026. Stable exported APIs are in the package
README; untyped cases below deliberately remain generic Error rather than implied
new exported reason codes. Native runtime/physical observations remain open.

| Trigger | Public signal | Recovery/resource behavior |
|---|---|---|
| Consent pending | requesting-camera | Unanswered prompt remains untimed. Stop invalidates generation; late acquired tracks stop. |
| Blocked/missing/unreadable/unsupported/other acquisition | CameraAccessError code/stage/retryable; original native cause/name/message | One Error reaches onError/start rejection; owned preparation releases. Explicit retry after correcting cause. |
| Slow initial GLB | loading-asset; ResourceTimeoutError asset-timeout | Bounded wait, failed active start releases media. Replace asset or recreate before retrying failed initial readiness. |
| Invalid/missing GLB | Generic Error, start rejects/onError once | Initial startup fails safely. Replacement setGlasses rejects to caller and retains valid active model; host owns replacement copy. |
| Slow worker/runtime | readiness stages; ResourceTimeoutError tracker-timeout or optional-stage Error | Bounded initialization. Confirmed face-ready optional failure may attempt one face-only fallback; no endless extension. |
| Cached incompatible worker | Generic Error with version mismatch | Reject before live dispatch; preparation does not conceal mismatch with optional fallback. Deliver matching SDK/worker. |
| Worker crash/live timeout | Health recovering/restarts and loading-tracker status; final generic Error on exhaustion | Existing bounded local recovery; no extra camera acquisition, stale capture/result rejection remains. |
| Optional graph failure/budget | Health featureFallback and optional availability | Supported face-only path, no fake hand/hair results. Prepared fallback preserves state on adoption. |
| Stream ended | Generic Error from ended listener | Release all media/worker; explicit Start/resync. No automatic reacquisition. |
| WebGL context loss | Generic Error/status error | Release media/worker; reference resync recreates renderer/session. No automatic restore guarantee. |
| Stop/hidden/dispose | cancelled readiness and idle/disposed lifecycle | Release acquired tracks/worker and waits. Earlier startup callbacks cannot change current generation. |
| Cancel prepare | Preparation promise rejects; cancelled readiness on stop/dispose | Callers handle rejection. Rejection may be AbortError or stopped-worker Error; cancellation is not a camera denial. |
| Asset supersession/session recreation | Latest resource and host revision ownership | Abort fetch, invalidate/dispose late parse, preserve current choice on failed replacement, ignore stale host updates. |

Ready/prepared indicate graph readiness, never recognized fitting or GPU completion.
Each failed active startup reports once; per-asset replacement errors belong to its
returned promise. Stage callbacks may call stop/dispose; generation/ownership
checks prevent rearming work. Preparation is explicit network/GPU work and keeps
only bounded timing data; no new persistence, telemetry or camera uploads.

Asset/renderer/stream reason enums beyond these exported classes are deferred to
evidence of host need. The current Error/health/status/host recreation recipe covers
their actions without a second overlapping SDK state machine.
