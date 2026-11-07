// Pure: small starting points for a client's own tab (each is a page spec, checked like any page).

type Raw = Record<string, unknown>;
const select = (key: string, label: string, options: string[]) => ({ key, label, type: "select", options });

/** Small starting points for a client's own tab. */
export const TAB_STARTERS: Record<string, Raw> = {
  notes: {
    title: "Notes",
    icon: "pen",
    color: "#FFD60A",
    description: "Meetings, ideas and anything to remember",
    spec: { collections: [], blocks: [{ type: "notes", id: "notes", title: "Notes" }] },
  },
  links: {
    title: "Links",
    icon: "list",
    color: "#64D2FF",
    description: "Shared folders, tools and references",
    spec: { collections: [], blocks: [{ type: "links", id: "links", title: "Links" }] },
  },
  checklist: {
    title: "Checklist",
    icon: "list",
    color: "#30D158",
    description: "Things to do or check for this client",
    spec: {
      collections: [
        {
          key: "items",
          name: "Checklist",
          singular: "Item",
          titleField: "item",
          fields: [
            { key: "item", label: "Item", type: "text" },
            { key: "done", label: "Done", type: "checkbox" },
          ],
        },
      ],
      blocks: [{ type: "checklist", id: "list", title: "Checklist", collection: "items", doneField: "done" }],
    },
  },
  tracker: {
    title: "Tracker",
    icon: "kanban",
    color: "#BF5AF2",
    description: "Anything with a status and a date",
    spec: {
      collections: [
        {
          key: "entries",
          name: "Entries",
          singular: "Entry",
          titleField: "name",
          fields: [
            { key: "name", label: "Name", type: "text" },
            select("status", "Status", ["To do", "Doing", "Waiting", "Done"]),
            { key: "date", label: "Date", type: "date" },
            { key: "notes", label: "Notes", type: "longtext" },
          ],
        },
      ],
      blocks: [
        { type: "board", id: "board", title: "By status", collection: "entries", groupBy: "status" },
        { type: "table", id: "all", title: "All entries", collection: "entries", columns: ["name", "status", "date"], sortBy: "date" },
      ],
    },
  },
};

export const STARTER_KEYS = Object.keys(TAB_STARTERS);
