import { MarblePane } from "@marble/ui";
import { HelpCommandExamples } from "./help-command-examples";

const HelpPage = () => {
  return (
    <MarblePane
      description="Temporary interactive command-menu examples while the final help surface is still taking shape."
      title="Help"
    >
      <HelpCommandExamples />
    </MarblePane>
  );
};

export default HelpPage;
