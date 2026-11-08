import { computeLayout, createEngine, parseOrb } from "../src/index";
import { verifyConformance } from "../../core/test/suite";

verifyConformance("douyin-miniprogram", { parse: parseOrb, createEngine, computeLayout });
