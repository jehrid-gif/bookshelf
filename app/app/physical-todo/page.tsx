import { redirect } from "next/navigation";

// "Physical Books What Need Readin'" is now a Library filter rather than its
// own page — send old links straight to the equivalent filtered view.
export default function PhysicalTodoPage() {
  redirect("/library?filter=physical_todo");
}
