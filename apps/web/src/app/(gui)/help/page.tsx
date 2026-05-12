import { MarblePane } from "@marble/ui";
import { HelpCommandExamples } from "./view";

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
