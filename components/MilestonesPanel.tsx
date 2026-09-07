"use client";

import SidePanel from "./SidePanel";

// Milestones + Reading Personality, pulled out of the dashboard flow into a
// panel you open on demand — a "how am I doing overall" check-in rather
// than something that needs to sit on the page at all times.
export default function MilestonesPanel({
  justHitMilestone,
  upcomingMilestone,
  milestoneRemaining,
  personality,
  onClose,
}: {
  justHitMilestone: number | null;
  upcomingMilestone: number;
  milestoneRemaining: number;
  personality: { title: string; blurb: string } | null;
  onClose: () => void;
}) {
  return (
    <SidePanel title="🏆 Milestones" onClose={onClose}>
      {justHitMilestone ? (
        <p className="text-sm text-amber-800 font-medium">
          You just hit {justHitMilestone} books finished!
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-600">
            {milestoneRemaining} more book{milestoneRemaining === 1 ? "" : "s"} to your{" "}
            {upcomingMilestone}th finish.
          </p>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden mt-2">
            <div
              className="h-full bg-brass rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((upcomingMilestone - milestoneRemaining) / upcomingMilestone) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </>
      )}
      {personality && (
        <div className="mt-4 pt-3 border-t border-stone-100">
          <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">
            Reading Personality
          </p>
          <p className="font-semibold text-ink">{personality.title}</p>
          <p className="text-xs text-stone-500 mt-0.5">{personality.blurb}</p>
        </div>
      )}
    </SidePanel>
  );
}
