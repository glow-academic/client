/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { MainLayoutClient } from "./layout-client";
import { getLayoutContextData } from "./layout-server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initial = await getLayoutContextData();

  return <MainLayoutClient initial={initial}>{children}</MainLayoutClient>;
}
