import { useCallback, useEffect, useState } from "react";
import { client } from "~/lib/api-client";

export interface CommunityProfile {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
  is_primary: boolean;
  user_group_key: string;
  user_role: "owner" | "moderator" | "member";
}

export function useCommunityProfiles() {
  const [profiles, setProfiles] = useState<CommunityProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.app.profiles.$get({
        query: {},
      });

      if (response.ok) {
        const result = await response.json();
        // API returns { data: [...] } wrapper
        setProfiles(Array.isArray(result?.data) ? result.data : []);
      } else {
        console.error("Failed to fetch community profiles");
        setProfiles([]);
      }
    } catch (error) {
      console.error("Error fetching community profiles:", error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    loading,
    refetch: fetchProfiles,
  };
}
