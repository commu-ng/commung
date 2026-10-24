import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { client } from "~/lib/api-client";
import type { SharedUser } from "~/types/profile";

type ApiSharedUser = Omit<SharedUser, "primary_profile_id"> & {
  primary_profile_id: string | null | undefined;
};

export function useProfileSharing(profileId: string) {
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchSharedUsers = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    try {
      const response = await client.app.profiles[":profile_id"].users.$get({
        param: { profile_id: profileId },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/auth/login");
          return;
        }
        throw new Error("Failed to fetch shared users");
      }

      const result = await response.json();
      const users = (result.data.users || []).map(
        (user: ApiSharedUser): SharedUser => ({
          ...user,
          primary_profile_id: user.primary_profile_id ?? null,
        }),
      );
      setSharedUsers(users);
    } catch (error) {
      console.error("Error fetching shared users:", error);
      setSharedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [profileId, navigate]);

  const addUser = async (
    profileId: string,
    username: string,
    role: "admin",
  ) => {
    const response = await client.app.profiles[":profile_id"].users.$post({
      param: { profile_id: profileId },
      json: { username, role },
    });

    if (!response.ok) {
      if (response.status === 401) {
        navigate("/auth/login");
        return;
      }
      const errorData = await response.json();
      const errorMsg =
        "error" in errorData &&
        typeof errorData.error === "object" &&
        errorData.error?.message
          ? errorData.error.message
          : "Failed to add user";
      throw new Error(errorMsg);
    }

    await fetchSharedUsers();
  };

  const removeUser = async (profileId: string, sharedProfileId: string) => {
    const response = await client.app.profiles[":profile_id"][
      "shared-profiles"
    ][":shared_profile_id"].$delete({
      param: { profile_id: profileId, shared_profile_id: sharedProfileId },
    });

    if (!response.ok) {
      if (response.status === 401) {
        navigate("/auth/login");
        return;
      }
      const errorData = await response.json();
      const errorMsg =
        "error" in errorData &&
        typeof errorData.error === "object" &&
        errorData.error?.message
          ? errorData.error.message
          : "Failed to remove user";
      throw new Error(errorMsg);
    }

    await fetchSharedUsers();
  };

  const reload = () => {
    fetchSharedUsers();
  };

  useEffect(() => {
    fetchSharedUsers();
  }, [fetchSharedUsers]);

  return {
    sharedUsers,
    loading,
    addUser,
    removeUser,
    reload,
  };
}
