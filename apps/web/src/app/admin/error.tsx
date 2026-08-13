'use client';
import { useLocale } from '../../components/locale-provider';
import { translate } from '../../lib/i18n/messages';
import { AdminPageHeader } from '../../components/admin/admin-ui';
import { Button } from '../../components/ui/button';
export default function Error({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const locale = useLocale();
  return (
    <div className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.loadErrorHeading')}
        description={translate(locale, 'admin.loadErrorHelp')}
      />
      <Button onClick={reset}>{translate(locale, 'admin.retry')}</Button>
    </div>
  );
}
