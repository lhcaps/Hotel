import { CustomerLoginClient } from './customer-login-client';
import { deriveCustomerLoginPresentation } from './customer-login-presentation';

// Server component. Reads the server-only browser OAuth test mode
// directly from process.env so it can prerender at build time without
// requiring the full web environment to be populated. The web process
// validates the env at boot via @room/config's requireWebEnvironment;
// this page does not need to re-validate.
export default function LoginPage() {
  const presentation = deriveCustomerLoginPresentation({
    ROOM_TEST_OAUTH_BROWSER_ENABLED: process.env.ROOM_TEST_OAUTH_BROWSER_ENABLED,
    ROOM_TEST_OAUTH_PROVIDER_ID: process.env.ROOM_TEST_OAUTH_PROVIDER_ID,
  });
  return <CustomerLoginClient presentation={presentation} />;
}
