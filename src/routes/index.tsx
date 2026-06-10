import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/aurahac/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AuraHAC — Live HAC Grades, GPA & Calendar" },
      { name: "description", content: "Premium mobile dashboard for Home Access Center: live grades, GPA engine, what-if simulator, and synced assignment calendar." },
    ],
  }),
  component: AppShell,
});
