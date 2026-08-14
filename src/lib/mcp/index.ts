import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listConcepts from "./tools/list-concepts";
import learningPath from "./tools/learning-path";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "studygraph",
  title: "StudyGraph",
  version: "1.0.0",
  instructions:
    "Knowledge-graph tools for StudyGraph, an adaptive learning platform. Use these to inspect the concept graph for a course and to compute the prerequisite path to any target concept. A learner's personal mastery data stays on their own device and is not exposed here.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listConcepts, learningPath],
});
