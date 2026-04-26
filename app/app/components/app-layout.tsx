import { useCallback, useEffect, useRef, useState } from "react";
import { MastodonLayout } from "~/components/layout";
import { NavigationProgress } from "~/components/NavigationProgress";
import { UnreadCountProvider } from "~/contexts/UnreadCountContext";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { usePrefetchRoutes } from "~/hooks/usePrefetchRoutes";
import { client } from "~/lib/api-client";
import { env } from "~/lib/env";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const { isAuthenticated, isLoading: authLoading, currentProfile } = useAuth();
  const { instanceName } = useCurrentInstance();
  usePrefetchRoutes();
  const headerRef = useRef<HTMLDivElement>(null);

  // Fetch unread notification and message counts
  const profileId = currentProfile?.id;
  const fetchUnreadCounts = useCallback(async () => {
    if (!isAuthenticated || !profileId) return;

    try {
      // Fetch both notification and message counts in parallel
      const [notificationResponse, messageResponse] = await Promise.all([
        client.app.notifications["unread-count"].$get({
          query: { profile_id: profileId },
        }),
        client.app.messages["unread-count"].$get({
          query: { profile_id: profileId },
        }),
      ]);

      if (notificationResponse.ok) {
        const notificationData = await notificationResponse.json();
        setUnreadCount(notificationData.data.count);
      }

      if (messageResponse.ok) {
        const messageData = await messageResponse.json();
        setUnreadMessageCount(messageData.data.count);
      }
    } catch (err) {
      console.error("Failed to fetch unread counts:", err);
    }
  }, [isAuthenticated, profileId]);

  // Track header visibility using Intersection Observer
  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry?.isIntersecting ?? false);
      },
      {
        threshold: 0,
      },
    );

    observer.observe(headerElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchUnreadCounts();

    // Only poll for unread counts when header is visible
    if (!isHeaderVisible) return;

    const interval = setInterval(fetchUnreadCounts, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts, isHeaderVisible]);

  return (
    <UnreadCountProvider
      refreshUnreadCounts={fetchUnreadCounts}
      isHeaderVisible={isHeaderVisible}
    >
      <NavigationProgress />
      <div ref={headerRef}>
        <MastodonLayout
          isAuthenticated={isAuthenticated}
          isLoading={authLoading}
          communityName={instanceName}
          consoleUrl={env.consoleUrl}
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        >
          {children}
        </MastodonLayout>
      </div>
    </UnreadCountProvider>
  );
}
