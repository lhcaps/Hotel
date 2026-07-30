import { AvailabilitySearchForm } from '../../../components/availability-search-form';
import { AvailabilitySearchResults } from '../../../components/availability-search-results';
export default function SearchPage() {
  return (
    <main id="main-content">
      <AvailabilitySearchForm />
      <AvailabilitySearchResults />
    </main>
  );
}
