import { computeLayout, createEngine, parse } from "../src/index";
import { verifyConformance } from "../../core/test/suite";

verifyConformance("javascript", { parse, createEngine, computeLayout });
