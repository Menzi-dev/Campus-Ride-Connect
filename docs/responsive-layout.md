# Responsive layouts and rider navigation

The running entry point is `mobile/index.js` → `mobile/App.tsx`. Both `App.tsx`
and the alternate `AppNavigator.tsx` use `AppLayout`.

`AppLayout` gives the navigator a bounded, shrinkable area and renders one rider
bottom bar as its sibling. Home, History, Schedule and Profile no longer render
their own bars. The bar stays mounted when changing rider tabs; it takes up its
own space, including the device's bottom safe area. Page content scrolls above
it. Rider tabs share the same header policy and do not animate the bar.

The app uses the available phone/tablet width and centers its frame up to 1200px
on larger displays. Screen roots can shrink within the viewport. Dashboard grids,
earnings cards and narrow rows wrap; map heights update on resize/rotation.
Leaflet observes its container size. History pagination and driver/security bars
reserve space rather than overlaying content. Tall dialogs and face verification
can scroll on short screens; shared bottom sheets have a tablet width limit.

## Validation

From `mobile`, run `npm.cmd run typecheck`.

The browser check uses Playwright, a local Expo server, and mocked API responses.
It never needs real credentials or modifies backend data. To install the browser
tool in an ignored directory without changing the app's dependencies:

```powershell
npm.cmd install --prefix .expo/layout-tools --no-save --package-lock=false playwright
node .expo/layout-tools/node_modules/playwright/cli.js install chromium
```

Start Expo in one terminal:

```powershell
npm.cmd run web -- --offline --port 8083
```

In another terminal, also from `mobile`:

```powershell
$env:PLAYWRIGHT_MODULE = (Resolve-Path '.expo/layout-tools/node_modules/playwright').Path
npm.cmd run check:responsive
```

Set `APP_URL` if using another local port. An existing Playwright installation
can also be supplied through `PLAYWRIGHT_MODULE`.
Pass `-- --screenshots` to save phone and tablet previews under
`mobile/.expo/responsive-checks`.

The checks cover rider navigation at 320×568, 390×844, 768×1024, 1024×768,
1280×800, 844×390 and 568×320. They verify one persistent rider bar, its bottom
position, content bounds, horizontal overflow, and scrolling without moving the
bar. Additional checks cover driver/security pages and the admin dashboard at
four sizes, user management in landscape, profile editing, password recovery,
and login/registration at the seven sizes.

These are web layout checks with fixtures. On physical Android/iOS devices,
also verify rotation, notches/home indicators, the software keyboard, camera
verification, and active ride/payment/SOS flows with your normal test accounts.

## Page chrome and action review

`screenChrome.ts` selects one header for each registered route. Pages with their
own header and primary tabs suppress the stack header; pages without a custom
back control retain the native one. `AppLayout` supplies safe-area padding where
a page does not already handle it. Registration keeps its step-back controls.
Pagination uses "Previous" to distinguish it from leaving a page. Web font
families include a system sans-serif fallback when custom fonts are unavailable.

The second mocked browser suite checks detail pages at the same seven sizes:

```powershell
npm.cmd run check:pages
```

It covers saved-card validation and deletion confirmation, rider rating,
university settings save/stay/leave, notification dismissal, user and incident
pagination, ride monitoring, authenticated audio playback and downloads,
populated security lists, missing phone/audio feedback, and driver acceptance,
chat, trip status updates and rider rating. It checks duplicate native headers
on pages with custom controls. All mutations are intercepted by fixtures.

Saved-card and settings confirmation dialogs work on web and native. Card
mutation controls are disabled while loading or saving; loading failures offer
retry. Audio downloads include authentication; players release resources when
leaving the page. Security loading failures show retry feedback. Leaflet maps
observe their containers across admin, security and driver pages as well as the
rider pages.

Camera, device phone/share/file pickers, native keyboards, actual charging,
real-time backend polling, and real SOS dispatch require physical-device and
integration checks; mocked browser checks do not validate these services.
