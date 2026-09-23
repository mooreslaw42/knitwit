import { LegalPage } from '@/components/legal-page';
import { ACCESSIBILITY } from '@/lib/legal';
import { usePageTitle } from '@/lib/use-page-title';

export default function ACCESSIBILITYScreen() {
  usePageTitle(ACCESSIBILITY.title);
  return <LegalPage document={ACCESSIBILITY} />;
}
