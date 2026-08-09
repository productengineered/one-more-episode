import { redirect } from "next/navigation";

// Upcoming moved to the home page; keep old bookmarks/PWA links working.
export default function UpcomingRedirect() {
  redirect("/");
}
