import { AppLayout } from "@/components/AppLayout";

export default function AppRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
