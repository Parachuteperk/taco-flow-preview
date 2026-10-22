// Generated from the C3 L1.map by tools/levels/build-levels.mjs; load after L1.js.
// Render: draw sprite px at C.TW*z/254*scale; anchor (flip ? w-ax : ax, ay) at iso tile corner (x1+1, y1+1).
// The painted base diamond lies inside rect and never covers walk tiles.
// Blocks describe map tiles only; level-blocks.js preserves the ASCII loader output.
(function (L1) {
  if (!L1 || !L1.map) return;
  L1.blocks = [{"kind":"building","name":"Derrick Hall","rect":[0,0,11,5]},{"kind":"building","name":"Taylor-Murphy Hall","rect":[13,0,21,4]},{"kind":"building","name":"Flowers Hall","rect":[23,0,29,4]},{"kind":"building","name":"Flowers Hall","rect":[22,1,22,4]},{"kind":"building","name":"Evans Liberal Arts","rect":[0,30,11,35]},{"kind":"building","name":"Comal Hall","rect":[13,31,21,35]},{"kind":"building","name":"Old Main","rect":[31,10,35,17]}];
  L1.buildings = [{"sprite":"old_main","name":"Old Main","rect":[31,10,35,17],"scale":2.9195,"flip":true,"replaces":"oldMain"},{"sprite":"flowers_hall","name":"Flowers Hall","rect":[23,0,29,4],"scale":2.6403,"flip":true},{"sprite":"evans_liberal_arts","name":"Evans Liberal Arts","rect":[0,30,11,35],"scale":3.1422,"flip":false},{"sprite":"derrick_hall","name":"Derrick Hall","rect":[0,0,11,5],"scale":3.8778,"flip":false},{"sprite":"academic_generic","name":"Taylor-Murphy Hall","rect":[13,0,21,4],"scale":2.5198,"flip":false},{"sprite":"corner_wing_l","name":"Comal Hall","rect":[13,31,21,35],"scale":2.5971,"flip":false}];
}(window.TF && window.TF.LEVELS && window.TF.LEVELS.L1));
