import type { Metadata } from "next";
import { StyleguideClient } from "./styleguide-client";

export const metadata: Metadata = {
  title: "Styleguide — CoachOS Design System",
};

export default function StyleguidePage() {
  return <StyleguideClient />;
}
