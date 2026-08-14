import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { MasteryBar, Panel, SectionTitle } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { COURSES, conceptsForCourse } from "@/lib/studygraph/curriculum";
import { courseMastery } from "@/lib/studygraph/engine";

export const Route = createFileRoute("/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — StudyGraph" },
      {
        name: "description",
        content:
          "Browse StudyGraph subject maps, switch active courses and see how each knowledge graph is structured.",
      },
      { property: "og:title", content: "Subjects — StudyGraph" },
      { property: "og:description", content: "Browse and switch between StudyGraph subject knowledge maps." },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { state, setProfile } = useStudyGraph();

  return (
    <AppLayout title="Subjects" subtitle="Every knowledge map available to you">
      <div className="grid gap-4 md:grid-cols-2">
        {COURSES.map((course) => {
          const concepts = conceptsForCourse(course.id);
          const mastery = courseMastery(state, course.id);
          const active = state.profile.courseId === course.id;
          return (
            <Panel key={course.id} className="p-6">
              <SectionTitle
                eyebrow={`${course.units.length} units · ${concepts.length} concepts`}
                title={course.name}
                action={
                  active ? (
                    <span className="rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setProfile({ courseId: course.id })}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
                    >
                      Switch
                    </button>
                  )
                }
              />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {concepts.length} mapped concepts across {course.units.length} units.
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Graph mastery</span>
                  <span className="tabular-nums">{Math.round(mastery * 100)}%</span>
                </div>
                <div className="mt-1.5">
                  <MasteryBar value={mastery} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {course.units.slice(0, 5).map((u) => (
                  <span key={u.id} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                    {u.name}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <Link
                  to="/graph"
                  search={{ concept: undefined }}
                  onClick={() => setProfile({ courseId: course.id })}
                  className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
                >
                  Open map
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setProfile({ courseId: course.id })}
                  className="accent-gradient rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Study this
                </Link>
              </div>
            </Panel>
          );
        })}
      </div>
    </AppLayout>
  );
}
