/** The message after coming back from Instagram's sign-in (?ig=…). */
export function IgNotice({ flag }: { flag?: string }) {
  const text: Record<string, [string, "green" | "red" | "orange"]> = {
    connected: ["Instagram connected. The first update runs in the background and takes a minute or two; refresh the page to see it.", "green"],
    denied: ["You cancelled the Instagram sign-in. Nothing was connected.", "orange"],
    personal: ["That's a personal Instagram account. Switch it to a Professional account (Business or Creator) in the Instagram app → Settings → Account type, then connect again.", "orange"],
    failed: ["Instagram didn't let us connect. Try again; if it keeps failing, the account may need to be added as a tester on the Meta app.", "red"],
    not_configured: ["Instagram isn't set up in Personal Hub yet (the Meta app keys are missing).", "orange"],
  };
  const t = flag ? text[flag] : undefined;
  if (!t) return null;
  return (
    <p role="status" className={`mb-4 rounded-[14px] px-3 py-2 text-[13px] ${t[1] === "green" ? "bg-green/12 text-green" : t[1] === "red" ? "bg-red/12 text-red" : "bg-orange/12 text-orange"}`}>
      {t[0]}
    </p>
  );
}
