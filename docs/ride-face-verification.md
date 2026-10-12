# Account face matching before ride requests

For both immediate and scheduled bookings, route selection opens payment
selection without creating a ride. Confirming payment opens the guided scan.
After successful server comparison with the signed-in account's enrollment
image, the app shows a success screen. Continuing creates the ride and its
pending payment record in one backend transaction. Immediate rides then enter
Finding Drivers. Scheduled rides remain SCHEDULED until their booking time.
A backend job checks due, verified, paid bookings every ten seconds, so the
rider does not need to keep the app open for dispatch. A payment record is a
payment-method selection, not an actual card charge.

The model compares both images on the server using OpenCV YuNet detection,
SFace alignment/embedding and cosine similarity. The local threshold is 0.45;
this has not been calibrated on campus users. Exactly one clear face is
required in both images. Probe images are not saved. Existing enrollment
photos saved as JPEG data URLs in the legacy face_embedding column are
supported; missing or unusable enrollment requires support intervention.
The implementation does not enroll a new reference during ride verification.

POST /api/face/verify-ride requires an authenticated account. A successful
comparison produces a confirmation valid for 120 seconds, bound to that user
and the exact ride/payment details. POST /api/rides/request and its legacy
alias reject unverified requests. Tokens authorize one new ride; a stable
client request ID makes exact retry submissions idempotent. A new scan for a
different route cannot reuse an old confirmation. Ride face_matched_at and
face_match_method audit fields record verification. Driver queues exclude
requests with no match; dispatch enforces ownership, verification and due time.

This is local face similarity plus client-side guided movements, not a
spoof-resistant biometric authentication service. A malicious client can
submit a photograph or prerecorded video. Matching accuracy and false-match
rates require testing before production use. Do not describe the local
implementation as guaranteed account-owner verification.

## Run the matcher

The matcher is currently running on this computer. After a restart, from the
repository root, run:

```powershell
& ./backend/face-matcher/run.ps1
```

Keep it running alongside the backend and Expo. It binds only 127.0.0.1:8090;
the HTTPS proxy does not expose that port. If unavailable, verification fails
closed with a retry message. To install on another development computer:

```powershell
python -m venv .local-face/venv
& ./.local-face/venv/Scripts/python.exe -m pip install -r backend/face-matcher/requirements.txt
New-Item -ItemType Directory -Force .local-face/models
```

Download the model files from the official OpenCV Zoo:
- [YuNet 2023mar](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet), save as .local-face/models/yunet.onnx.
- [SFace 2021dec](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface), save as .local-face/models/sface.onnx.
Keep each model's accompanying license. Local virtual environments, model
weights and test images are ignored by Git. JPA development schema updates
create the new ride columns; production requires reviewed migrations.

## Validation

Backend tests cover expired, reused, wrong-owner and altered-draft confirmations,
rejection before ride/payment creation, and exact retry idempotency. Model tests
use OpenCV public sample images to check same-face comparison, different-face
rejection, no face, multiple faces, and invalid image data. These samples are
test fixtures, not account enrollments.

On a real device, test payment -> scan -> mismatch/retry -> success -> find
drivers, cancel before match, a future scheduled booking and due-time dispatch,
and driver/admin/security visibility. Physical camera and multi-device checks
remain manual.

## Driver acceptance

View Request -> Accept Ride opens the guided scan in driver mode.
POST /api/face/verify-driver requires an approved driver and a pending ride,
and compares the scan against that driver's enrollment image. Its confirmation
is bound to the driver and ride; it cannot authorize rider booking or another
ride. POST /api/driver/requests/{id}/accept requires faceVerificationToken.
Acceptance locks the ride row and rechecks availability, preventing another
driver from overwriting an assignment made during scanning. Success opens
DriverActiveRide; failed/cancelled scans do not assign the ride. Lost-response
retries return the same driver's already verified acceptance.

rides.driver_face_matched_at records the check. Starting a trip through the
driver status endpoint requires this timestamp. Legacy assigned rides without
driver verification cannot be started through that endpoint. The same local
matching and spoof-resistance limitations apply to drivers.
