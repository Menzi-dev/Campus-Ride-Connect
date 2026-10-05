# Recorded demonstration and supervisor Q&A

Status: recording script; final video and presenter identity pending.
Use approved test accounts and a disposable database. Keep passwords, mail
credentials and student details off camera. Show actual integrated behaviour;
label any fixture-only browser segment as mocked. Never trigger a real safety
dispatch to demonstrate the feature.

| Approximate time | Demonstration | Explain |
|---|---|---|
| 0:00–0:40 | Title and group introduction | Problem, affected users, scope |
| 0:40–1:30 | Login/registration/recovery | Roles; hashing; selfie capture limitation |
| 1:30–2:40 | Rider request/schedule | Locations, rand fare, validation, pending state |
| 2:40–4:00 | Driver request/accept/message/trip phases | Participant ownership and lifecycle |
| 4:00–4:40 | History/rating/profile/cards | Metadata only; no payment settlement |
| 4:40–5:40 | Admin applications/users/settings | Confirmation, role access, dirty edits |
| 5:40–6:20 | Synthetic security incident/audio | Evidence access and dispatch-record limitation |
| 6:20–6:50 | Phone/tablet/landscape resize | One persistent rider bar; reachable dialogs |
| 6:50–7:40 | Architecture/tests/limitations | API/database split; nine unit tests; measured vs unmeasured |
| 7:40–8:10 | Reflection and improvements | Real user feedback and priorities |

Include an opening card with all names and student numbers, a clear cursor,
readable zoom and voice narration. Verify playback from another computer.
Export a common format such as MP4 and place it in the submission Demo folder.
Add the recording date/build and note whether external services were available.

Prepare answers: Why MySQL? Which relationships are enforced? How is a request
assigned safely? What is JWT? Which endpoints are public? How does password
reset expire? Why is selfie acceptance not biometric verification? What does
PENDING payment mean? Which tests mock services? What did users actually say?
Which accessibility contrast pairs fail? What would be changed before deployment?
