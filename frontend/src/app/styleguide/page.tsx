import type { Metadata } from "next";

import { StyleguideView } from "./_components/styleguide-view";

export const metadata: Metadata = {
  title: "Styleguide",
  description:
    "Colour, typography and every shared component in the People interface.",
};

export default function StyleguidePage() {
  return <StyleguideView />;
}
