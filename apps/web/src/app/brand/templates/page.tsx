import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { createTemplate } from "@/app/actions";
import { getBrandContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function TemplatesPage() {
  const { workspace } = await getBrandContext();
  const templates = await prisma.outreachTemplate.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Outreach templates"
        description="Merge tags: {{first_name}} {{brand}} {{campaign}} {{fee}} {{brief_link}} {{topics}}"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">Create template</h2>
          <form action={createTemplate} className="mt-4 space-y-3">
            <Input name="name" label="Name" placeholder="Warm invite" required />
            <Input
              name="subject"
              label="Subject"
              placeholder="{{brand}} collab: {{campaign}}"
              required
            />
            <Textarea
              name="body"
              label="Body"
              rows={10}
              required
              placeholder="Hi {{first_name}}, ..."
            />
            <Button type="submit">Save template</Button>
          </form>
        </Card>

        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                {t.channel}
              </p>
              <h3 className="mt-1 font-semibold text-slate-900">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.subject}</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {t.body}
              </pre>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
