import test from "node:test";
import assert from "node:assert/strict";
import { constrainBox } from "../backend/cloudtrailblazer/static/subgraph-window.mjs";

test("moving and resizing cannot take the window outside the tab viewport", () => {
  for (const stage of [{width:660,height:420}, {width:415,height:420}, {width:200,height:150}]) {
    for (const box of [{left:-100,top:-100,width:510,height:350},
      {left:1000,top:1000,width:1000,height:1000}, {left:80,top:80,width:10,height:10}]) {
      const result = constrainBox(box, stage);
      assert.ok(result.left >= 8 && result.top >= 8);
      assert.ok(result.left+result.width <= stage.width-8);
      assert.ok(result.top+result.height <= stage.height-8);
    }
  }
});

test("valid geometry stays unchanged when the tab has room", () => {
  const box = {left:30,top:40,width:400,height:260};
  assert.deepEqual(constrainBox(box,{width:660,height:420}),box);
});
