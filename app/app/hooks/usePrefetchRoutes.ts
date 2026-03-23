import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { client } from "~/lib/api-client";

const ITEMS_PER_PAGE = "20";

function prefetchPosts(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["posts", profileId],
    queryFn: async () => {
      const response = await client.app.posts.$get({
        query: { limit: ITEMS_PER_PAGE, profile_id: profileId },
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return await response.json();
    },
    initialPageParam: undefined as string | undefined,
  });
}

function prefetchNotifications(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["notifications", profileId],
    queryFn: async () => {
      const response = await client.app.notifications.$get({
        query: { profile_id: profileId, limit: ITEMS_PER_PAGE },
      });
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return await response.json();
    },
    initialPageParam: undefined as string | undefined,
  });
}

function prefetchMessages(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["conversations", profileId],
    queryFn: async () => {
      const response = await client.app.conversations.$get({
        query: { profile_id: profileId, limit: ITEMS_PER_PAGE },
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return (await response.json()).data;
    },
    initialPageParam: 0,
  });
  qc.prefetchInfiniteQuery({
    queryKey: ["group-chats", profileId],
    queryFn: async () => {
      const response = await client.app["group-chats"].$get({
        query: { profile_id: profileId, limit: ITEMS_PER_PAGE },
      });
      if (!response.ok) throw new Error("Failed to fetch group chats");
      return (await response.json()).data;
    },
    initialPageParam: 0,
  });
}

function prefetchAnnouncements(qc: QueryClient, profileId: string) {
  qc.prefetchQuery({
    queryKey: ["announcements", profileId],
    queryFn: async () => {
      const response = await client.app.announcements.$get({
        query: { profile_id: profileId },
      });
      if (!response.ok) throw new Error("Failed to fetch announcements");
      return (await response.json()).data;
    },
  });
}

function prefetchBoards(qc: QueryClient) {
  qc.prefetchQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const response = await client.app.boards.$get();
      if (!response.ok) throw new Error("Failed to fetch boards");
      return (await response.json()).data;
    },
  });
}

function prefetchBookmarks(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["bookmarks", profileId],
    queryFn: async () => {
      const response = await client.app.bookmarks.$get({
        query: { profile_id: profileId, limit: ITEMS_PER_PAGE },
      });
      if (!response.ok) throw new Error("Failed to fetch bookmarks");
      return await response.json();
    },
    initialPageParam: undefined as string | undefined,
  });
}

function prefetchProfiles(qc: QueryClient) {
  qc.prefetchQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const response = await client.app.profiles.$get({ query: {} });
      if (!response.ok) throw new Error("Failed to fetch profiles");
      return (await response.json()).data;
    },
  });
}

type PrefetchFn = (qc: QueryClient, profileId: string) => void;

const routePrefetchers: Record<string, PrefetchFn> = {
  "/": prefetchPosts,
  "/notifications": prefetchNotifications,
  "/messages": prefetchMessages,
  "/announcements": prefetchAnnouncements,
  "/boards": prefetchBoards,
  "/bookmarks": prefetchBookmarks,
  "/profiles": prefetchProfiles,
};

const allPaths = Object.keys(routePrefetchers);

export function usePrefetchRoutes() {
  const queryClient = useQueryClient();
  const { isAuthenticated, currentProfile, belongsToCurrentInstance } =
    useAuth();
  const { instanceSlug } = useCurrentInstance();
  const prefetchedForProfile = useRef<string | null>(null);

  const profileId = currentProfile?.id;

  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !profileId) return;
    if (!belongsToCurrentInstance) return;
    if (prefetchedForProfile.current === profileId) return;
    prefetchedForProfile.current = profileId;

    // Prefetch all routes immediately
    for (const path of allPaths) {
      const prefetcher = routePrefetchers[path];
      if (prefetcher) {
        prefetcher(queryClient, profileId);
      }
    }
  }, [
    isAuthenticated,
    instanceSlug,
    profileId,
    belongsToCurrentInstance,
    queryClient,
  ]);
}
