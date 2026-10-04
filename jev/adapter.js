/* Application adapter; all writes require an explicit action button. */
(function () {
  'use strict';
  function init() {
    JevUI.mount({
      title: 'Trading journal · plan adherence',
      description:
        'Compare your notes with your written plan. These labels do not change challenge status, position size, or the numerical coach.',
      fields: [
        {
          key: 'plan',
          label: 'Your trading plan and permitted exceptions',
          max: 4000,
          rows: 3,
          placeholder:
            'Enter only after the setup closes. Stop after two losses. Never increase size to recover a loss.',
        },
        { key: 'notes', label: 'Trade notes — one per line, up to 20', max: 24000, rows: 4 },
      ],
      filter: true,
      runLabel: 'Review trade notes',
      input(v) {
        return {
          plan: v.plan,
          notes: v.notes
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          metrics: window.JevApp.journalMetrics(),
        };
      },
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
