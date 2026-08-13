/**
 * Regression: custom typography tokens must not strip text-* colors in cn()/twMerge.
 * Keep font-size list in sync with lib/utils.ts.
 */
import { extendTailwindMerge } from "tailwind-merge";
import assert from "node:assert/strict";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading",
            "title",
            "subtitle",
            "body",
            "body-sm",
            "label",
            "caption",
            "hero",
          ],
        },
      ],
    },
  },
});

const merged = twMerge(
  "bg-primary text-primary-foreground text-body-sm font-bold",
);
assert.match(merged, /text-primary-foreground/);
assert.match(merged, /text-body-sm/);
assert.match(merged, /bg-primary/);

const sizeWins = twMerge("text-body text-body-sm");
assert.equal(sizeWins, "text-body-sm");

console.log("verify-cn-merge: ok");
