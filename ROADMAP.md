# Use cases and proposed improvements

Goal of the app: get a person out of harm's way in time. Each row is a situation the app
should handle, what it does today, and what would make it safer.

Status: ✅ done · 🟡 partly · ⬜ not yet

## A. Knowing what is coming

| # | Situation | Today | Proposed improvement |
|---|-----------|-------|----------------------|
| 1 | Post names how many targets ("2 Реактиви", "один або два") | ✅ number read and shown | Add up the numbers across posts: "5 targets in the oblast now" |
| 2 | Post names a destination ("на Теплик", "в сектор …", "курсом на …") | ✅ shown in the Targets list and on the map | — |
| 3 | Post names where it came from ("зі сходу", "повз Немирів") | ✅ arrow and dashed "next" line on the map | Join consecutive posts about one target into a real track with measured speed |
| 4 | Target's course passes over the user | ✅ "HEADING YOUR WAY" tag | Raise a pre-alert ("~7 min away") before the district itself is named |
| 5 | Ballistic threat for the whole oblast | 🟡 shown in the list; no siren because no district is named | Treat oblast-wide ballistic as DANGER for everyone: there are only minutes |
| 6 | Target leaves the oblast or is shot down | ✅ removed from the list | Say it aloud: "target near you is gone" |
| 7 | Channel is silent or unreachable | 🟡 error line on screen | Loud warning "no data for 3 min — do not rely on the app"; second source (official air-raid API) as backup |
| 8 | Place not in the table (small village) | ⬜ ignored | Look the name up in a full gazetteer of the oblast (≈1,500 settlements) |
| 9 | Several channels disagree | ⬜ one channel | Monitor 2–3 channels; the most cautious one wins |
| 10 | Explosion already happened nearby ("вибух", "приліт") | 🟡 alerts if the district is named | Separate "impact" alert with different advice: stay sheltered, second strike possible |

## B. Knowing where the user is

| # | Situation | Today | Proposed improvement |
|---|-----------|-------|----------------------|
| 11 | Standing between two districts | ✅ both count (distance in Settings) | — |
| 12 | Driving towards a district under threat | ✅ "DANGER AHEAD" alert | Use the planned route from the maps app instead of a straight line |
| 13 | Cycling / walking | ✅ advice changes with speed | Detect a train or bus (speed + rail line) and give matching advice |
| 14 | Phone locked in a pocket | 🟡 app keeps checking, position is not refreshed | Background location (needs the "Always" permission and a paid Apple account for review) |
| 15 | User is at work, family is at home | ✅ pin extra districts by hand | Named places: "Home", "School", "Parents" with their own alert sound |
| 16 | GPS off, indoors, or abroad | 🟡 last known position is used | Show how old the position is; ask to pick the district by hand when it is stale |
| 17 | Travelling to another oblast | ⬜ Vinnytsia only | Zone tables for other oblasts, chosen automatically by position |
| 18 | In a shelter with no signal | ⬜ | Keep the last known situation on screen with its age; alert when signal returns |

## C. Making sure the alarm is noticed

| # | Situation | Today | Proposed improvement |
|---|-----------|-------|----------------------|
| 19 | Phone on silent | ✅ siren plays anyway | — |
| 20 | Asleep at night | 🟡 siren for 60 s | Repeat until acknowledged; rising volume; flash the torch |
| 21 | Driving, cannot read the screen | ✅ voice says what to do | CarPlay / Android Auto banner; repeat the voice every 30 s |
| 22 | Deaf or hard of hearing | 🟡 vibration | Torch strobe, Apple Watch haptics, full-screen flashing |
| 23 | Blind or low vision | 🟡 voice advice | Full VoiceOver labels; spoken distance and direction of each target |
| 24 | Headphones in | 🟡 siren plays in the headphones | Also play through the speaker |
| 25 | Alarm fatigue: too many alerts | 🟡 distance setting | "Night mode": only DANGER wakes you; show how many alerts per day each setting gives |
| 26 | Battery nearly empty | ⬜ | Low-power mode: check every 2 min, warn at 15 % |
| 27 | App closed by the system | 🟡 best-effort background check | Push notifications from a small server (needs a paid Apple account) |

## D. Helping the person act

| # | Situation | Today | Proposed improvement |
|---|-----------|-------|----------------------|
| 28 | Where is the nearest shelter? | 🟡 opens a maps search | Built-in list of the city's official shelters with walking time, works offline |
| 29 | Not enough time to reach a shelter | ✅ "two walls" advice | Countdown: "about 4 min — a shelter 300 m away is reachable / stay inside" |
| 30 | In a car on a bridge or by a fuel station | ✅ general advice | Know the dangerous places (bridges, substations, fuel depots) and name the one you are near |
| 31 | Family wants to know you are safe | 🟡 reminder text | One-tap "I'm safe" message with location to chosen contacts |
| 32 | Children or elderly parents | ⬜ | Family mode: see each other's alert state; a simple big-button screen |
| 33 | After the strike | ⬜ | Checklist: wait 15 min, gas / glass / wires, first-aid basics, when to call 101/103 |
| 34 | Injured, needs help | ✅ call 112 button | Show own coordinates in large type to read out to the operator |
| 35 | All clear | 🟡 alert disappears | Spoken "all clear for your district", with how long it lasted |
| 36 | User does not speak Ukrainian | ✅ English UI and voice | More languages; simpler wording |

## E. Trust and reliability

| # | Situation | Today | Proposed improvement |
|---|-----------|-------|----------------------|
| 37 | Parser misreads a post | 🟡 62 automatic tests on real posts | "Wrong?" button that saves the post so the rule can be fixed; weekly check against the live channel |
| 38 | Channel changes its wording | ⬜ | Fallback: any post naming your district still alerts (already so), plus a daily self-test |
| 39 | Is the app still working? | 🟡 "last check" time | Daily silent self-check and a weekly reminder to run the test alarm |
| 40 | Free Apple install expires after 7 days | ⬜ | Warn two days before; a paid account removes the limit |

## Suggested order

1. **#5 Oblast-wide ballistic = DANGER** — highest risk, smallest change.
2. **#4 Pre-alert when a course points at you** — minutes of extra time.
3. **#7 "No data" warning + second source** — silence must never look like safety.
4. **#28 Offline shelter list** and **#29 countdown**.
5. **#20 Repeat until acknowledged** and **#22 torch strobe**.
6. **#3 Real tracks from consecutive posts**.
