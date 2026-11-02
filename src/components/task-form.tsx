import { Field } from "./ui";
import { Submit } from "./submit";

type Task = { title: string; notes: string; clientId: number | null; due: string | null; estimateMin: number; priority: number };

export function TaskForm({
  action,
  clients,
  task,
  submitLabel = "Add task",
}: {
  action: (fd: FormData) => Promise<void>;
  clients: { id: number; name: string }[];
  task?: Task;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Title">
        <input name="title" required maxLength={300} defaultValue={task?.title} className="field" placeholder="What needs doing?" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due">
          <input name="due" type="date" defaultValue={task?.due ?? ""} className="field" />
        </Field>
        <Field label="Time needed (min)">
          <input name="estimateMin" type="number" min={5} max={1440} step={5} defaultValue={task?.estimateMin ?? 30} className="field" />
        </Field>
        <Field label="Client">
          <select name="clientId" defaultValue={task?.clientId ?? ""} className="field">
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={task?.priority ?? 1} className="field">
            <option value={0}>Low</option>
            <option value={1}>Normal</option>
            <option value={2}>High</option>
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={task?.notes} className="field" />
      </Field>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}
