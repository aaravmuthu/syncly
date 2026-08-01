import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDistricts from "./tools/list-districts";
import calculateGpa from "./tools/calculate-gpa";
import gradeNeeded from "./tools/grade-needed";
import categoryAverage from "./tools/category-average";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "aurahac",
  title: "AuraHAC",
  version: "0.1.0",
  instructions:
    "Academic tools for AuraHAC, a Home Access Center dashboard. Use these to compute GPAs, weighted course averages, and the score needed on remaining work, and to list supported districts. Student grade data itself stays encrypted on the student's own device and is not exposed here.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDistricts, calculateGpa, gradeNeeded, categoryAverage],
});
