import { redirectIfAuthenticated } from "../lib/auth";
import Homepage from "./homepage/page";

const RootHomepage = async () => {
  await redirectIfAuthenticated();
  return <Homepage />;
};

export default RootHomepage;
