import { LegalPage } from '@/components/legal-page';
import { TERMS } from '@/lib/legal';
import { usePageTitle } from '@/lib/use-page-title';

export default function TERMSScreen() {
  usePageTitle(TERMS.title);
  return <LegalPage document={TERMS} />;
}
