import { useEffect, useRef } from "react";
import { env } from "~/lib/env";
import { useAuth } from "./useAuth";

interface CommungNative {
  pushToken: string;
  platform: "ios" | "android";
}

declare global {
  interface Window {
    commungNative?: CommungNative;
  }
}

export function usePushToken() {
  const { isAuthenticated } = useAuth();
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      registeredToken.current = null;
      return;
    }

    const register = async () => {
      const native = window.commungNative;
      if (!native?.pushToken) return;
      if (registeredToken.current === native.pushToken) return;

      try {
        const response = await fetch(`${env.apiBaseUrl}/console/devices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            push_token: native.pushToken,
            platform: native.platform,
          }),
        });

        if (response.ok) {
          registeredToken.current = native.pushToken;
        }
      } catch {
        // Silently fail - will retry on next page load
      }
    };

    register();

    // Also listen for token updates (native side re-injects on each page load)
    const interval = setInterval(register, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);
}
