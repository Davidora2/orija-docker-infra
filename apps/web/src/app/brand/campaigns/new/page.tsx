import { redirect } from "next/navigation";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createCampaign } from "@/app/actions";

export default function NewCampaignPage() {
  async function action(formData: FormData) {
    "use server";
    const id = await createCampaign(formData);
    redirect(`/brand/campaigns/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create campaign"
        description="Define brief, terms, compensation, and platforms"
      />
      <Card>
        <form action={action} className="space-y-4">
          <Input name="title" label="Campaign title" placeholder="Spring product launch" required />
          <Input
            name="objective"
            label="Objective"
            placeholder="Awareness, UGC rights, conversions..."
          />
          <Select name="compModel" label="Compensation model" defaultValue="HYBRID">
            <option value="PAID">Paid</option>
            <option value="GIFTING">Gifting</option>
            <option value="AFFILIATE">Affiliate</option>
            <option value="HYBRID">Hybrid (paid + affiliate)</option>
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="feeCents" label="Flat fee (USD)" type="number" placeholder="1200" />
            <Input
              name="affiliateRate"
              label="Affiliate rate %"
              type="number"
              step="0.1"
              placeholder="15"
            />
          </div>
          <Input
            name="platforms"
            label="Platforms (comma-separated)"
            defaultValue="INSTAGRAM,TIKTOK"
          />
          <Textarea
            name="brief"
            label="Brief"
            rows={8}
            required
            placeholder="## Creative direction&#10;What to post, talking points, assets..."
          />
          <Textarea
            name="terms"
            label="Terms & usage rights"
            rows={6}
            required
            placeholder="Usage window, exclusivity, disclosure, payment terms..."
          />
          <Button type="submit">Launch campaign</Button>
        </form>
      </Card>
    </div>
  );
}
