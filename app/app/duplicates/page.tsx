import { redirect } from "next/navigation";

// Duplicates is now a Library filter rather than its own page.
export default function DuplicatesPage() {
  redirect("/library?filter=duplicates");
}
