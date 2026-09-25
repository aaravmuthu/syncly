import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCirclesTool from "./tools/list-circles";
import listPlansTool from "./tools/list-plans";
import getPlanTool from "./tools/get-plan";
import createPlanTool from "./tools/create-plan";
import rsvpPlanTool from "./tools/rsvp-plan";
import sendCircleMessageTool from "./tools/send-circle-message";

// The OAuth issuer must be the direct Supabase host; the project ref is the one
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "syncly",
  title: "Syncly",
  version: "0.1.0",
  instructions:
    "Tools for Syncly, a private group planning app. Use `list_circles` to find the member's circles, `list_plans` and `get_plan` to read plans (timing, attendance, shortlisted options, rides), `create_plan` to start a new plan, `rsvp_plan` to respond, and `send_circle_message` to post in a circle's chat. Everything acts as the signed-in member only.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCirclesTool,
    listPlansTool,
    getPlanTool,
    createPlanTool,
    rsvpPlanTool,
    sendCircleMessageTool,
  ],
});
