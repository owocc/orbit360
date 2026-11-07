import { computeLayout, createEngine, parseOrb } from "../src/index";
import { verifyConformance } from "../../core/test/suite";

verifyConformance("wechat-miniprogram", { parse: parseOrb, createEngine, computeLayout });
