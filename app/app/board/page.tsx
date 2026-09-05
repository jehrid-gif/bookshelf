import { redirect } from "next/navigation";

// The Kanban board now lives on the Dashboard — send any old link/bookmark
// there instead of keeping a second copy of the page around.
export default function BoardPage() {
  redirect("/");
}
