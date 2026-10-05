# API inventory (source-based)

Base: http://localhost:8080/api for local development. JSON except multipart
registration/selfie/audio uploads. Protected requests use Authorization: Bearer
<token>. Refer to controller signatures for exact fields; error formats vary.
This inventory is not an OpenAPI contract or a live endpoint test.

| Area | Representative methods / paths | Source |
|---|---|---|
| Authentication | POST /auth/register; /auth/login; /auth/face/verify-direction; /auth/verification/face | AuthController |
| Recovery | POST /auth/password-reset/request; /verify; /confirm | AuthController |
| Account | GET/PUT /users/me; PUT /users/me/profile-photo | UserController |
| Saved metadata | GET/POST /users/me/payment-methods; PUT /{cardId}/default; DELETE /{cardId}; PUT /users/me/payment-method | UserController |
| Rider trips | POST /rides/request; GET /rides/active; /history; /scheduled; GET /rides/{id} | RideController |
| Trip actions | POST /rides/{id}/dispatch; /cancel; /complete; /rating; /rider-rating | RideController |
| SOS | POST /rides/{id}/sos; PUT /rides/{id}/sos/{alertId}/audio | RideController |
| Driver | GET /driver/stats; /earnings; /requests; /requests/{id}; /rides/{id}; POST /driver/online | DriverController |
| Driver actions | POST /driver/requests/{id}/accept; /decline; POST /driver/rides/{id}/status; /location | DriverController |
| Messaging | GET/POST /rides/{rideId}/messages | MessageController |
| Payment record | POST /rides/{rideId}/payment | PaymentController |
| Admin | GET /admin/dashboard/stats; /users; /rides/monitoring; /incidents; /settings | AdminController |
| Admin actions | PUT /admin/users/{id}/status; /admin/settings; POST /admin/driver-approvals/{id}/approve or reject | AdminController |
| Admin evidence | GET /admin/incidents/{id}; /admin/incidents/{id}/audio | AdminController |
| Security | GET /security/rides; /sos; POST /security/sos/{id}/dispatch; GET /security/sos/{id}/audio | SecurityController |

Saved cards contain display metadata; do not send full PAN/CVV to these APIs.
PaymentController inserts a PENDING record without a payment provider. Face
endpoints validate receipt of an image, not biometric identity or liveness.
Privileged registration and response redaction require security hardening.
