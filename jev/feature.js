/* Bounded decisions for this application. */
(function (root, factory) {
  const api = factory(
    root.JevContract || (typeof require === 'function' ? require('./contract.js') : null),
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JevFeature = api;
})(globalThis, function (C) {
  'use strict';

  const labels = {
    followed: 'Plan followed',
    exception: 'Documented exception',
    departure: 'Unplanned departure',
    insufficient: 'Insufficient evidence',
  };
  const F = {
    id: 'journal-review',
    private: true,
    build(input) {
      const plan = C.text(input.plan, 'Trading plan', 4000),
        notes = C.list(input.notes, 'Trade notes', 20).map((x) => C.text(x, 'Trade note', 1200));
      const questions = {};
      notes.forEach(
        (x, i) =>
          (questions['behavior' + i] = C.choice(
            'Compare `notes[' +
              i +
              ']` with `plan`. Identify evidence of whether this trade followed the stated plan. Profit or loss alone does not prove discipline or trader intent. Do not infer revenge trading without explicit evidence.',
            {
              followed: 'Note supplies enough evidence and conforms to the stated plan',
              exception: 'Note documents an exception explicitly allowed by the plan',
              departure: 'Note explicitly describes an action contrary to the plan',
              insufficient: 'Intent, execution or applicable plan rule is missing or ambiguous',
            },
          )),
      );
      return { state: { plan, notes, metrics: input.metrics || {} }, questions };
    },
    present(input, answers) {
      return input.notes.map((x, i) => ({
        title: 'Trade note ' + (i + 1),
        label: labels[C.decision(answers['behavior' + i])] || 'Needs review',
        detail: x,
        confidence: answers['behavior' + i].confidence,
      }));
    },
  };

  return Object.freeze(F);
});
