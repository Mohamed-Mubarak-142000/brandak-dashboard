import { redirect } from "next/navigation";

// The overview page isn't built yet; the review queue is where the work is.
export default function Home() {
  redirect("/payments");
}
