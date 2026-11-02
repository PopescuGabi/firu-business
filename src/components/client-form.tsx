import { Field } from "./ui";
import { Submit } from "./submit";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#5856D6", "#30B0C7", "#FF3B30", "#8E8E93"];

export function ClientForm({
  action,
  client,
  submitLabel = "Create client",
}: {
  action: (fd: FormData) => Promise<void>;
  client?: { name: string; description: string; appName: string; color: string };
  submitLabel?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name">
        <input name="name" required maxLength={200} defaultValue={client?.name} className="field" autoFocus />
      </Field>
      <Field label="App name" hint="Leave empty if you don't build an app for this client.">
        <input name="appName" maxLength={200} defaultValue={client?.appName} className="field" />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={2} maxLength={1000} defaultValue={client?.description} className="field" />
      </Field>
      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-medium text-label-2">Colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={(client?.color ?? COLORS[0]).toUpperCase() === c} className="peer sr-only" />
              <span
                className="block size-8 rounded-full ring-offset-2 ring-offset-elevated peer-checked:ring-2 peer-focus-visible:ring-2"
                style={{ background: c, ["--tw-ring-color" as string]: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}
