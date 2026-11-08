import { redirect } from "next/navigation";

// Prompts live in Clients → Your style.
export default function PromptsPage() {
  redirect("/clients?view=style");
}
