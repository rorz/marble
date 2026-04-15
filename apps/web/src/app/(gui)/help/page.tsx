import { MarbleEmptyState, MarblePane } from "@marble/ui";

const HelpPage = () => {
  return (
    <MarblePane
      title="Help"
      width="Narrow"
    >
      <MarbleEmptyState
        description="Documentation and guided workflows will land here once the shared help surface is ready."
        title="Work in progress"
      />
    </MarblePane>
  );
};

export default HelpPage;
