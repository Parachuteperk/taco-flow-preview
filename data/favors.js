(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Favors = factory(); }
}(this, function () {
  'use strict';
  return [
    { id: 'presidentPass', name: 'President Pass', l1Cents: 6000, weeklyLimit: 1, neverMonday: false, line: "Gaillard and I share a golf cart, darlin'. He'll love your little stand.", effect: 'Automatically pass the next inspection; retain the $40 grant and WEST +10 Rise %.' },
    { id: 'rainInsurance', name: 'Rain Insurance', l1Cents: 3500, weeklyLimit: 1, neverMonday: false, line: 'Weather is for people without a policy.', effect: 'Cover rain or storm sales losses once this week, up to the level cap; costs double after the forecast.' },
    { id: 'mavsTickets', name: 'Mavs Tickets for Ali', l1Cents: 4500, weeklyLimit: 1, neverMonday: false, line: 'Courtside, honey. Try not to cry on the Jumbotron.', effect: 'Skip Ali\'s next rant slowdown.' },
    { id: 'buildPermit', name: 'Extra Build Permit', l1Cents: 3000, weeklyLimit: 2, neverMonday: true, line: 'Zoning is just a conversation.', effect: 'Add one build today per permit; Matt still walks to and completes each build.' },
    { id: 'vipConnection', name: 'VIP Connection', l1Cents: 5000, weeklyLimit: 1, neverMonday: false, line: 'I know everyone, sugar. Everyone knows me first.', effect: 'Bring Boko (+40% draw for 20 s), Prof. Bigorder (8 tacos), or the Strutters tomorrow or early.' }
  ];
}));
