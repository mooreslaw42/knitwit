import { LegalPage } from '@/components/legal-page';
import { PRIVACY } from '@/lib/legal';
import { usePageTitle } from '@/lib/use-page-title';

export default function PRIVACYScreen() {
  usePageTitle(PRIVACY.title);
  return <LegalPage document={PRIVACY} />;
}
