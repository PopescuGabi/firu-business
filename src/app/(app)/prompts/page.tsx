import { redirect } from "next/navigation";

// Prompts now live in Clients → Brain, as "Your style".
export default function PromptsPage() {
  redirect("/clients?view=brain#style");
}
