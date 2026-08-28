/**
 * Reload the page once, when a NEW service worker takes over.
 *
 * WHY THIS EXISTS — THE SAME BUG, A SECOND TIME
 * ---------------------------------------------
 * vite.config already tells the first half of this story: `registerType` used to
 * be 'prompt', the app never rendered a prompt, and four consecutive releases
 * were deployed correctly, verified live, and invisible on the actual device.
 * The tester kept re-reporting bugs that were already fixed.
 *
 * Switching to 'autoUpdate' with skipWaiting + clientsClaim fixed HALF of it.
 * The new worker now installs, activates and claims the open page — but
 * CLAIMING A PAGE DOES NOT RELOAD IT. The document keeps running the JavaScript
 * it already parsed, which is the old build, for as long as that tab lives. So
 * a whole day's work again looked like nothing had been pushed: the cabinet
 * still showed its white slab, the drawers still would not open, and the patient
 * was still the old one — on a client that had every fix sitting in its cache.
 *
 * `controllerchange` is the moment the swap actually happens. Reloading there is
 * the only thing that puts the new code on screen without the user knowing to
 * hard-refresh.
 *
 * THE FIRST-VISIT GUARD IS NOT OPTIONAL. On a first-ever visit there is no
 * controller, the worker installs and claims, and controllerchange fires — for
 * the build the page is ALREADY running. Reloading there would make every new
 * player's first load flash and restart for no reason. `hadController` is the
 * difference between "the code changed under me" and "a worker appeared".
 */

/** How often a long-lived tab asks whether a new build exists. */
const POLL_MS = 60_000

export function reloadOnNewServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // Read BEFORE any listener can fire. A page that arrived with no controller is
  // seeing this worker's first install, not an update to what it is running.
  const hadController = Boolean(navigator.serviceWorker.controller)

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    // Guard against the event firing twice — a second reload mid-navigation is
    // how you get a reload loop, which is worse than a stale build.
    reloading = true
    window.location.reload()
  })

  // POLL, because the check otherwise only happens on navigation.
  //
  // GitHub Pages serves sw.js with `Cache-Control: max-age=600`, so a tab that
  // is left open — which is exactly what happens while someone is testing a
  // build — can sit on the old worker indefinitely without ever asking. One
  // minute is far below the ten-minute cache window, so the first check after
  // that window expires costs a single conditional request.
  navigator.serviceWorker.ready
    .then((registration) => {
      setInterval(() => {
        // Swallow: an update check failing (offline, Pages hiccup) must never
        // surface as an unhandled rejection in a game.
        void registration.update().catch(() => {})
      }, POLL_MS)
    })
    .catch(() => {})
}
