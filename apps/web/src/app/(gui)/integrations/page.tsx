import { MarbleEmptyState, MarblePane } from "@marble/ui";

const IntegrationsPage = () => {
  return (
    <MarblePane
      title="Integrations"
      width="Narrow"
    >
      <MarbleEmptyState
        description="Integration setup is still being shaped around the shared UI package before the page is opened up."
        title="Work in progress"
      />
    </MarblePane>
  );
};

export default IntegrationsPage;
