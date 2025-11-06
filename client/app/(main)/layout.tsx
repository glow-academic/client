/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { AppShell } from "@/components/common/layout/AppShell";
import { Suspense } from "react";
import { MainLayoutClient } from "./layout-client";
import {
  createFeedback,
  getAssistantChatFull,
  getAssistantChatList,
  getLayoutContextData,
  markChatComplete,
  markIntroComplete,
  refreshAnalytics,
  switchEffectiveProfile,
} from "./layout-server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initial, snapshot, attemptData, attemptId } =
    await getLayoutContextData();

  return (
    <MainLayoutClient
      initial={initial}
      sessionSnapshot={snapshot}
      attemptData={attemptData}
      attemptId={attemptId}
      markIntroCompleteAction={markIntroComplete}
      markChatCompleteAction={markChatComplete}
      getAssistantChatListAction={getAssistantChatList}
      getAssistantChatFullAction={getAssistantChatFull}
      switchEffectiveProfileAction={switchEffectiveProfile}
      createFeedbackAction={createFeedback}
      refreshAnalyticsAction={refreshAnalytics}
    >
      {/* Only the PAGE AREA suspends */}
      <Suspense fallback={<AppShell.ContentSkeleton />}>{children}</Suspense>
    </MainLayoutClient>
  );
}
