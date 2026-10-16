# Shopper reference flow — current local implementation

15 October 2026. This is a framework-agnostic SDK consumer recipe, not a replacement
product shell or a validated shopper research result.

The primary order is preview → Start/Stop/Retry and one guidance message → active
choice/collection → collapsed advanced tools → asset provenance. Diagnostics,
calibration, hand controls and manual fit remain inside advanced controls. No
camera acquisition occurs while browsing; only explicit Start invokes `start()`.
Optional preparation is available to hosts but not invoked automatically here.

| State / action | Reference behavior |
|---|---|
| Idle | Camera consent explanation, initial choice and browsable catalog. |
| Starting | SDK readiness selects indeterminate stage copy. Stop stays reachable. |
| Searching/tracking | One positioning/movement instruction, changed only on new guidance. |
| Choose another frame | Product buttons stay enabled; loading candidate has aria-busy, active choice keeps aria-pressed. Separate live region names loading and active choices. |
| A→B→C | SDK latest-request ownership plus host revision/session checks allow only C to update choice/description/fit. |
| Choose current A while B loads | A becomes the latest request, cancelling B through existing SDK semantics. |
| Replacement failure | Current choice/description remain; product live region offers another choice. Camera session remains available. |
| Recreate during selection | Invalidate host revision, clear pending choice, dispose prior session; late callbacks cannot change the new state. |
| Camera/resource failure | Actionable reason-based copy and explicit Start/resync or another frame; catalog stays usable. Resync recreates the session before Start. |
| Stop/hidden/pagehide | SDK stops media/worker; foreground does not restart automatically. Pagehide disposes the reference session. |

Active choice is a host product identifier, not proof that a visible fit exists.
Initial copy says initial choice; searching/visible-fit callbacks provide tracking
status independently. No snapshot, face profile, cart or persistent shortlist is
introduced. Live comparison is repeated product switching; a dedicated two-choice
shortlist remains a later M18 host feature.

Indonesian reason/guidance dictionaries and static copy remain host-owned; hosts
can substitute their locale without modifying core. Full English/Indonesian
switching is later M18 work. Native buttons/disclosures preserve keyboard
activation and focus; touch targets remain ≥47 px. Controlled browser checks cover
keyboard selection, stable announcements, no overflow at 390 px and advanced
disclosure order. A real screen reader, 200% zoom and physical touch/landscape
review remain device acceptance tasks, not passed by these assertions.
