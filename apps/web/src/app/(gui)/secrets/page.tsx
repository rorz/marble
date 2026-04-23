import { MarblePane } from "@marble/ui";
import * as actions from "./actions";
import { SecretsPageView } from "./view";

export default async function SecretsPage() {
  const secrets = await actions.listSecrets();

  return (
    <MarblePane
      className="max-w-6xl"
      description="Named credentials are stored in Vault, then reused as program defaults with optional per-column overrides."
      title="Secrets"
      width="Full"
    >
      <SecretsPageView initialSecrets={secrets} />
    </MarblePane>
  );
}
