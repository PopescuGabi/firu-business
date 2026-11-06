import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/custom/blocks";
import { iconFor } from "@/components/custom/icons";
import { PageCoach } from "@/components/custom/page-coach";
import { PageSettings } from "@/components/custom/page-settings";
import type { ChatMessage } from "@/components/claude-panel";
import { and, asc, eq } from "drizzle-orm";
import { claudeAvailable } from "@/lib/ai/claude";
import { getDb, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPage, pageItems } from "@/lib/custom-pages-db";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const page = await getPage(user.id, (await params).slug);
  return { title: page?.title ?? "Page" };
}

/** One of this person's own pages (often made by the AI setup), rendered from its spec. */
export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const page = await getPage(user.id, (await params).slug);
  if (!page) notFound();
  const db = await getDb();
  const [items, settings, chat, claudeConfigured] = await Promise.all([
    pageItems(user.id, page.id),
    getSettings(user.id),
    db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, user.id), eq(schema.aiMessages.targetType, "page"), eq(schema.aiMessages.targetId, page.id)))
      .orderBy(asc(schema.aiMessages.id)),
    claudeAvailable(user.id),
  ]);
  const messages = chat.map<ChatMessage>((m) => ({ id: m.id, role: m.role as ChatMessage["role"], content: m.content, proposal: m.proposal, applied: m.applied }));
  const Icon = iconFor(page.icon);
  return (
    <>
      <PageHeader
        title={page.title}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Icon size={14} style={{ color: page.color }} /> {page.description || "Your page"}
          </span>
        }
        actions={
          <>
            <PageCoach pageId={page.id} spec={page.spec} messages={messages} claudeConfigured={claudeConfigured} />
            <PageSettings page={page} />
          </>
        }
      />
      <PageBlocks pageId={page.id} spec={page.spec} items={items} today={todayIn(settings.timezone)} />
    </>
  );
}
