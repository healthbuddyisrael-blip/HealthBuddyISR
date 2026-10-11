# Pilot production verification — October 10, 2026

Production: https://health-buddy-israel.vercel.app. Supabase:
`jvfevkatchjmajrioxod`. Application deployment:
`dpl_FRgSMjxcVDYhgRFGU2KjfQtWoKUr` (READY).

The user authenticated interactively in an isolated Edge profile. Credentials were
not requested, printed or copied. Tests use two explicitly labelled QA participant
accounts, created through existing Auth Admin and invitation activation APIs.
No emails were sent and no passwords were created. QA enrollment is restricted to September
27–October 3, outside the real first pilot reporting week of October 4–10.
All health values and images entered for these QA accounts are synthetic and
clearly labelled. No real participant report is used for write testing.

| Check                                            | Result  | Observed behavior                                                                                  |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| Authenticated coach overview                     | PASS    | Completed week before real enrollment shows zero expected real participants.                       |
| Draft creation and reload                        | PASS    | Average 6450.25, strength 1, aerobic 2 persist without evidence or complete notes.                 |
| Missing screenshot validation                    | PASS    | Submission rejected; entered fields retained.                                                      |
| Conversation status independent of report status | PASS    | Completed late conversation remains a draft with its date preserved.                               |
| Screenshot file selection and preview            | PASS    | Labelled synthetic PNG renders from mobile-compatible file input.                                  |
| Managed private Storage upload and submission    | PASS    | Submitted report reloads with a working signed image.                                              |
| Actual workout counts                            | PASS    | Coach overview shows strength 1, aerobic 2 and average 6450.25, with no extrapolation.             |
| Edit submitted report                            | PASS    | Corrected counts become strength 3, aerobic 0 and the text goal updates.                           |
| Duplicate prevention during edits                | PASS    | Exactly one QA report after four saved revisions.                                                  |
| Screenshot replacement and cleanup               | PASS    | One referenced replacement object; zero unreferenced QA images.                                    |
| Artificial daily records                         | PASS    | Zero daily records created for QA participants.                                                    |
| Other coach participant access                   | PASS    | Other coach's QA detail shows not-found and no reporting form.                                     |
| Coach access to admin pages                      | PASS    | Server redirects coach to coach home.                                                              |
| Anonymous screenshot access                      | PASS    | Public download and anonymous signing denied against an existing object.                           |
| Participant own submitted report                 | PASS    | Actual managed Auth QA session reads its own submitted report.                                     |
| Participant access to another report             | PASS    | Second QA participant receives no records for the first participant.                               |
| Participant screenshot access                    | PASS    | Both QA participant sessions are denied signed image access.                                       |
| Admin monitoring database query                  | PASS    | Two participants, one submitted, one pending; one completed conversation; 50% completion.          |
| Admin monitoring browser                         | Pending | Awaiting interactive admin login.                                                                  |
| Admin read-only report and private image         | Pending | Awaiting interactive admin login.                                                                  |
| QA cleanup and historical fingerprint comparison | PASS    | All tagged QA accounts, invitations, reports and images removed; real data fingerprints unchanged. |

The local release checks passed: 96 application tests, 10 SQL/RLS suites,
three existing concurrency scenarios, lint, typecheck, production build,
84 responsive browser layout checks and credential scanning. The final deployed
application passed public-page/asset smoke checks and four HTTP authentication
regression tests. SQL/RLS tests use a disposable local database; the managed
Storage and interactive coach checks above run against production.

Historical fingerprints matched after migration and after the explicitly approved
enrollment of the two real active, assigned participants. Batya's October 4–10
historical fallback remains strength 1 and aerobic 0. The previously deployed
workout counting function is unchanged. Final fingerprints after QA removal match
the pre-migration values for daily records, weekly figures, baselines, profiles,
assignments, legacy coaching check-ins and the workout function. Only the two
explicitly approved real pilot enrollments remain; no weekly reports have been
fabricated for these participants.

Admin browser verification remains blocked on interactive administrator login.
The isolated browser is open at the login page. It requires an existing authorized
administrator account; credentials must not be shared in chat. A fresh isolated
fixture can be used when that session is available. No QA data was left in
production while waiting.

Managed Auth deletion initially returned HTTP 500 while application QA profiles
still existed. Cleanup succeeded after deleting only the ownership-verified QA
application profiles, then retrying managed Auth deletion. No authentication
permissions or policies were changed. The exact cause of the initial managed API
failure was not established; operators should investigate that path if using
direct Auth account deletion for provisioned participants.

GitHub write access was unresolved at verification time. On October 11, 2026,
authentication with `healthbuddyisrael-blip` resolved access and the preserved
release was successfully published to `main` in
[HealthBuddyISR](https://github.com/healthbuddyisrael-blip/HealthBuddyISR).
Admin browser verification remains pending; GitHub publication does not imply
that this remaining check has passed.
