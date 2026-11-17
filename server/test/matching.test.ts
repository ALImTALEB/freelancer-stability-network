import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMatchScore } from "../src/matching.js";

test("scores distinct required skills, ignoring case and surrounding spaces", () => {
  assert.deepEqual(
    calculateMatchScore(
      ["React", "Node.js", "MongoDB", " react ", " "],
      ["REACT", " react ", "Node.js ", "Python"],
    ),
    {
      score: 67,
      matchedSkills: ["React", "Node.js"],
      missingSkills: ["MongoDB"],
    },
  );
});

test("handles full, disjoint, and empty skill sets", () => {
  assert.equal(calculateMatchScore(["React"], ["React", "CSS"]).score, 100);
  assert.equal(calculateMatchScore(["React"], ["CSS"]).score, 0);
  assert.equal(calculateMatchScore(["React"], []).score, 0);
  assert.equal(calculateMatchScore([], ["React"]).score, 0);
});
