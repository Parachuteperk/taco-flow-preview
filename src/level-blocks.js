// Load after world.js. Decorative region blocks also block the simulation grid.
(function (TF) {
  'use strict';
  var World = TF.World, build = World.build;
  World.build = function () {
    var result = build.apply(this, arguments), level = World.level;
    // ASCII maps already supply authoritative blocking tiles and interior door exits.
    if (!level || level.map || !level.blocks) return result;
    level.blocks.forEach(function (block) {
      var r = block.rect;
      for (var y = r[1]; y <= r[3]; y++) for (var x = r[0]; x <= r[2]; x++) {
        World.set(x, y, World.T.BUILDING);
        delete World.propType[y * World.W + x];
      }
    });
    World.props = World.props.filter(function (p) { return World.get(p.x, p.y) !== World.T.BUILDING; });
    World.exits = [];
    for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) {
      if (World.isPath(x, y) && (x === 0 || y === 0 || x === World.W - 1 || y === World.H - 1)) {
        World.exits.push({ x: x, y: y, ox: x === 0 ? -1 : x === World.W - 1 ? 1 : 0, oy: y === 0 ? -1 : y === World.H - 1 ? 1 : 0 });
      }
    }
    World.version++;
    return result;
  };
  TF.LevelBlocks = {
    // Snapshot the live world, including placed stands, objects and queue costs.
    masks: function (level) {
      if (level && level !== World.level) throw new Error('Load the level before requesting masks');
      var costs = new Float32Array(World.W * World.H), stairs = new Uint8Array(costs.length);
      for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) {
        var i = y * World.W + x;
        costs[i] = World.cost(x, y);
        stairs[i] = World.get(x, y) === World.T.STAIRS ? 1 : 0;
      }
      return { costs: costs, stairs: stairs };
    }
  };
})(window.TF);
