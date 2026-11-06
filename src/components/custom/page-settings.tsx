import { Settings2, Trash2 } from "lucide-react";
import { deletePage, renamePage } from "@/app/actions/custom-pages";
import { PAGE_COLORS, PAGE_ICONS } from "@/lib/custom-pages";
import { Sheet } from "../sheet";
import { DeleteFooter, Submit } from "../submit";
import { buttonClass, Field } from "../ui";
import { PAGE_ICON } from "./icons";

/** Rename a page, pick its icon and colour, or delete it (with everything on it). */
export function PageSettings({ page }: { page: { id: number; title: string; icon: string; color: string } }) {
  return (
    <Sheet title="Page settings" trigger={<Settings2 size={16} />} triggerLabel="Page settings" triggerClassName={buttonClass("gray", "sm")}>
      <form action={renamePage.bind(null, page.id)} className="flex flex-col gap-4">
        <Field label="Name">
          <input name="title" required maxLength={60} defaultValue={page.title} className="field" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 px-1 text-[13px] font-medium text-label-2">Icon</legend>
          <div className="grid grid-cols-8 gap-1.5">
            {PAGE_ICONS.map((name) => {
              const Icon = PAGE_ICON[name];
              return (
                <label key={name} className="grid aspect-square cursor-pointer place-items-center rounded-[12px] bg-fill text-label-2 has-[:checked]:bg-accent has-[:checked]:text-white" title={name}>
                  <input type="radio" name="icon" value={name} defaultChecked={page.icon === name} className="sr-only" />
                  <Icon size={17} />
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 px-1 text-[13px] font-medium text-label-2">Colour</legend>
          <div className="flex gap-2">
            {PAGE_COLORS.map((c) => (
              <label key={c} className="size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-[var(--bg)] has-[:checked]:ring-2 has-[:checked]:ring-label" style={{ background: c }} title={c}>
                <input type="radio" name="color" value={c} defaultChecked={page.color.toUpperCase() === c} className="sr-only" />
              </label>
            ))}
          </div>
        </fieldset>
        <Submit className="self-end">Save</Submit>
      </form>
      <DeleteFooter action={deletePage.bind(null, page.id)} message={`Delete “${page.title}” and everything on it? This can't be undone.`}>
        <Trash2 size={15} /> Delete page
      </DeleteFooter>
    </Sheet>
  );
}
