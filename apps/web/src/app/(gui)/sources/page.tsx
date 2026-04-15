import { MarbleEmptyState, MarblePane } from "@marble/ui";

const SourcesPage = () => {
  return (
    <MarblePane
      title="Sources"
      width="Narrow"
    >
      <MarbleEmptyState
        description="Source management is being pulled into the shared workspace patterns before this page opens up."
        title="Work in progress"
      />
    </MarblePane>
  );
};

export default SourcesPage;
