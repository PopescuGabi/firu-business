import { PageTransition } from "@/components/motion";

/** Re-mounts on every navigation, so each page slides in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
