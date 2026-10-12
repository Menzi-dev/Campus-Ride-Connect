# Admin dashboard figures and review

The dashboard reads one transaction-consistent snapshot from /api/admin/dashboard.
The approval list and its count therefore refer to the same snapshot. It refreshes
when focused, when returning to the app, after approval decisions, and every
15 seconds while active. A query failure returns an error instead of fabricated
zero figures or an empty pending list.

- Total Users counts all stored accounts, including inactive accounts.
- Driver Accounts counts stored accounts with the DRIVER role, including pending
  and rejected applicants. It is not a count of online or approved drivers.
- Requests Today counts ride records created from South African midnight inclusive
  to the next midnight exclusive. Cancelled requests count; future scheduled rides
  count on the day the booking was created.
- Pending Approvals counts the applications in the accompanying pending list.
- Open SOS Alerts counts all alerts not marked RESOLVED, CLOSED or CANCELLED;
  unresolved older alerts are not silently excluded.
- SOS-Free Trips is the percentage of completed rides with no SOS alert record,
  including resolved alert records. Multiple alerts on one ride count that ride
  once. No completed rides displays N/A. This is a reporting statistic, not an
  inferred safety guarantee. The displayed numerator and denominator explain it.

The header uses the stored university settings. Quick Actions remain connected
to User Management, Ride Monitoring, Incident Reports and University Settings.
Approve/reject updates driver approval and account status, then reloads the snapshot.

New multipart registrations retain submitted proof, licence and vehicle documents
as private application_documents data. Only PDF, JPEG and PNG files up to 4 MB
each are accepted. The admin preview fetches them with the session's authorization
header and displays a temporary browser blob, revoked after closing. Documents
are omitted from general user JSON. Old files previously discarded by registration
cannot be recovered. Native document preview currently directs users to the web
dashboard. Development schema updates create the new column at backend restart;
production deployment needs a reviewed migration.
