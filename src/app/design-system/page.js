import DesignSystemShowcase from "@/app/design-system/showcase";

export const metadata = {
  title: "Design System",
  description: "Internal LingoPro design system and component reference.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
