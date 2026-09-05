import { redirect } from "next/navigation";

// Special Editions is now a Library filter rather than its own page.
export default function SpecialEditionsPage() {
  redirect("/library?filter=special_editions");
}
