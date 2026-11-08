import { OrbBundle } from "../src/orb";
import { computeLayout, createEngine } from "../../core/src/index";
import { verifyConformance } from "../../core/test/suite";

verifyConformance("expo", {
  parse: (bytes) => OrbBundle.parse(bytes),
  createEngine,
  computeLayout,
});
