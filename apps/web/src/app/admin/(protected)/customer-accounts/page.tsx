import { redirect } from 'next/navigation';

export default function AdminCustomerAccountsAlias() {
  redirect('/admin/accounts?tab=customers');
}
