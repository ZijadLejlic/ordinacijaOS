import { MarketingStubPage } from "@/components/marketing/marketing-stub-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function FeaturesPage({ params }: Props) {
  return <MarketingStubPage params={params} pageKey="features" />;
}
