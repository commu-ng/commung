import { useQuery } from "@tanstack/react-query";
import { client } from "~/lib/api-client";

interface OnlineStatusResponse {
  profile_id: string;
  is_online: boolean;
}

/**
 * Hook to fetch online status for a list of profile IDs
 * Polls every 30 seconds to keep status up to date
 */
export function useOnlineStatus(profileIds: string[]) {
  return useQuery({
    queryKey: ["online-status", ...profileIds.sort()], // Sort for consistent cache key
    queryFn: async (): Promise<OnlineStatusResponse[]> => {
      if (profileIds.length === 0) {
        return [];
      }

      const response = await client.app.profiles["online-status"].$get({
        query: {
          profile_ids: profileIds,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch online status");
      }

      const result = await response.json();
      return result.data;
    },
    enabled: profileIds.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

/**
 * Hook to get online status for a single profile
 */
export function useProfileOnlineStatus(profileId: string | undefined) {
  const { data } = useOnlineStatus(profileId ? [profileId] : []);

  if (!profileId || !data) {
    return false;
  }

  return (
    data.find((status) => status.profile_id === profileId)?.is_online ?? false
  );
}
