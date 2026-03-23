import { useQuery } from "@tanstack/react-query";
import { client } from "~/lib/api-client";

interface CurrentInstance {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_verified: string | null;
  role: string | null;
  description: string | null;
  banner_image_url: string | null;
  starts_at: string;
  ends_at: string;
}

export function useCurrentInstance() {
  const { data: currentInstance, ...queryResult } = useQuery({
    queryKey: ["current-instance"],
    queryFn: async (): Promise<CurrentInstance | null> => {
      const response = await client.app.me.instance.$get();
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("session_token"),
    staleTime: 15 * 60 * 1000, // 15 minutes - instance data rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache
  });

  return {
    currentInstance,
    instanceName: currentInstance?.name || "",
    instanceSlug: currentInstance?.slug || "",
    userRole: currentInstance?.role || null,
    isOwner: currentInstance?.role === "owner",
    isModerator:
      currentInstance?.role === "moderator" ||
      currentInstance?.role === "owner",
    ...queryResult,
  };
}
