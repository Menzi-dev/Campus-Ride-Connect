// Screen layout rules: decide which routes use a native header and which need shared spacing around
// device edges.
// These screens already render their own header, or are primary navigation tabs.
// Where: CUSTOM_HEADERS, OWN_SAFE_AREA and OWN_BOTTOM_INSET in navigation/screenChrome.ts.
// How: usesNativeHeader(), needsTopInset() and needsBottomInset() check these route sets; App.tsx
// and AppLayout.tsx use the results for screen layout.
const CUSTOM_HEADERS = new Set([
  'Landing', 'Login', 'EmailVerification', 'CreateAccount', 'Legal', 'AdminDashboard', 'DriverDashboard',
  'SecurityDashboard', 'Home', 'RiderHistory', 'RiderSchedule', 'RiderProfile',
  'RiderPaymentMethods', 'DriverEarnings', 'DriverHistory', 'DriverProfile',
  'DriverActiveRide', 'ViewRideDetails', 'RatingDriver', 'Chat', 'UserManagement',
  'RideMonitoring', 'IncidentReports', 'AudioRecordings', 'UniversitySettings',
  'ActiveRidesMonitor', 'SosAlerts',
]);

const OWN_SAFE_AREA = new Set(['Landing', 'CreateAccount', 'Legal', 'AdminDashboard', 'DriverDashboard']);
const OWN_BOTTOM_INSET = new Set([
  ...OWN_SAFE_AREA, 'Home', 'RiderHistory', 'RiderSchedule', 'RiderProfile',
  'DriverDashboard', 'DriverEarnings', 'DriverHistory', 'DriverProfile',
  'SecurityDashboard', 'ActiveRidesMonitor', 'SosAlerts', 'ResolvedSos',
]);

export const usesNativeHeader = (route: string) => !CUSTOM_HEADERS.has(route);
export const needsTopInset = (route: string) => CUSTOM_HEADERS.has(route) && !OWN_SAFE_AREA.has(route);
export const needsBottomInset = (route: string) => !OWN_BOTTOM_INSET.has(route);
