import { MarbleCard, MarbleCardHeader, MarbleCardTitle } from "@marble/ui";
import type { NextPage } from "next";
import { Pane } from "../../../components/pane";

const ProfilesPage: NextPage = async () => {
  return (
    <Pane
      crumbs={[
        {
          label: "Profiles",
        },
      ]}
    >
      <MarbleCard>
        <MarbleCardHeader>
          <MarbleCardTitle>Hello</MarbleCardTitle>
        </MarbleCardHeader>
      </MarbleCard>
    </Pane>
  );
};

export default ProfilesPage;
