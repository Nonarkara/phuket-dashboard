import { redirect } from "next/navigation";

/**
 * /war-room now lives at / — redirect all traffic there permanently.
 * Bookmarks and deep-links continue to work.
 */
export default function WarRoomRedirectPage() {
  redirect("/");
}
