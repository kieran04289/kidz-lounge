// Polling that pauses while the tab is hidden (Oct 2026). Every poll in the
// app used a plain setInterval, so a schedule left open in a background tab
// kept making ~9 requests a minute all day (chat, tasks, support counts, the
// schedule itself), competing with real work for the API's small database
// pool. Hidden: nothing runs. Back in view: it runs at once if it's due, so
// what you see is never older than one interval.
export function pollWhileVisible(fn, ms) {
  let last = Date.now();
  const run = () => { last = Date.now(); fn(); };
  const timer = setInterval(() => { if (!document.hidden) run(); }, ms);
  const onVisible = () => { if (!document.hidden && Date.now() - last >= ms) run(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
