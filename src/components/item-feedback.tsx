import { and, desc, eq } from "drizzle-orm";
import { MessageSquareText, Trash2 } from "lucide-react";
import { addFeedback, deleteFeedback } from "@/app/actions/feedback";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { FeedbackCheck } from "./check";
import { Submit } from "./submit";
import { Card } from "./ui";

/** Client feedback for one reel / carousel: what they said and whether it's handled. */
export async function ItemFeedback({ targetType, targetId }: { targetType: "reel" | "carousel"; targetId: number }) {
  const user = await requireUser();
  const db = await getDb();
  const notes = await db
    .select()
    .from(schema.clientFeedback)
    .where(
      and(
        eq(schema.clientFeedback.userId, user.id),
        eq(schema.clientFeedback.targetType, targetType),
        eq(schema.clientFeedback.targetId, targetId),
      ),
    )
    .orderBy(eq(schema.clientFeedback.status, "done"), desc(schema.clientFeedback.createdAt));
  return (
    <Card className="mt-6 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-label-2">
        <MessageSquareText size={14} /> Client feedback
      </p>
      {notes.length > 0 && (
        <ul className="mb-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-2.5">
              <FeedbackCheck id={n.id} done={n.status === "done"} label={n.note.slice(0, 40)} />
              <p className={n.status === "done" ? "flex-1 text-[14px] whitespace-pre-line text-label-2 line-through" : "flex-1 text-[14px] whitespace-pre-line"}>
                {n.note}
              </p>
              <form action={deleteFeedback.bind(null, n.id)}>
                <button aria-label="Delete this note" className="cursor-pointer rounded-full p-1 text-label-3 hover:bg-fill hover:text-red">
                  <Trash2 size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addFeedback} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="target" value={`${targetType}:${targetId}`} />
        <textarea name="note" required rows={1} placeholder="What did the client say?" aria-label="New client feedback" className="field flex-1 [field-sizing:content]" />
        <Submit className="self-end">Add</Submit>
      </form>
    </Card>
  );
}
