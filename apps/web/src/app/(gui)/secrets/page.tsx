import { MarblePane } from "@marble/ui";
import { listSecrets } from "./actions";
import { SecretsPageView } from "./view";

const SecretsPage = async () => {
  const secrets = await listSecrets();

  return (
    <MarblePane
      description="Define secrets that can be used by your programs in order to call external APIs and services."
      title="Secrets"
      width="ExtraWide"
    >
      <SecretsPageView initialSecrets={secrets} />
    </MarblePane>
  );
};
export default SecretsPage;
