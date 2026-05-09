import { MarblePane } from "@marble/ui";
import { listSecrets } from "./actions";
import { SecretsPageView } from "./view";

export default async function SecretsPage() {
  const secrets = await listSecrets();

  return (
    <MarblePane
      className="max-w-6xl"
      description="Define secrets that can be used by your programs in order to call external APIs and services."
      title="Secrets"
      width="Full"
    >
      <SecretsPageView initialSecrets={secrets} />
    </MarblePane>
  );
}
