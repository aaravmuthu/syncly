export const PLAN_BUILDER_EVENT = "syncly:plan-builder";

export type PlanBuilderRequest = {
  prompt?: string;
  groupId?: string | null;
  /** Start building right away instead of opening on the prompt. */
  autoStart?: boolean;
};

/** Opens the Magic AI plan builder from anywhere in the app shell. */
export function openPlanBuilder(request: PlanBuilderRequest = {}) {
  window.dispatchEvent(
    new CustomEvent<PlanBuilderRequest>(PLAN_BUILDER_EVENT, { detail: request }),
  );
}
