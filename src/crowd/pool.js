(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {}; root.TF.Crowd.Pool = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function create(factory, reset, initialSize) {
    var free = [], objects = [], owned = new WeakMap(), created = 0, inUse = 0, i;
    function make() { var obj = factory(created); objects.push(obj); created++; owned.set(obj, false); return obj; }
    for (i = 0; i < (initialSize || 0); i++) free.push(make());
    return {
      acquire: function () { var obj = free.length ? free.pop() : make(); owned.set(obj, true); inUse++; return obj; },
      release: function (obj) {
        if (owned.get(obj) !== true) return false;
        if (reset) reset(obj);
        owned.set(obj, false); inUse--; free.push(obj); return true;
      },
      stats: function () { return { created: created, inUse: inUse, free: free.length }; },
      snapshot: function () { return free.map(function (obj) { return objects.indexOf(obj); }); },
      restore: function (ids) {
        var seen = new Set(), j, id;
        if (!Array.isArray(ids)) throw new Error('Invalid pool snapshot');
        for (j = 0; j < ids.length; j++) {
          id = ids[j];
          if (!Number.isInteger(id) || id < 0 || id >= created || seen.has(id)) throw new Error('Invalid pool snapshot');
          seen.add(id);
        }
        free.length = 0;
        for (j = 0; j < created; j++) {
          if (reset) reset(objects[j]);
          owned.set(objects[j], !seen.has(j));
        }
        for (j = 0; j < ids.length; j++) free.push(objects[ids[j]]);
        inUse = created - free.length;
      }
    };
  }
  return { create: create };
}));
