import type React from "react";
import { createContext, useContext, useState } from "react";

// Shared current profile state across all useAuth instances
interface CurrentProfileContextType {
  currentProfileId: string | null;
  setCurrentProfileId: (id: string | null) => void;
  hasSetInitialProfile: boolean;
  setHasSetInitialProfile: (value: boolean) => void;
}

const CurrentProfileContext = createContext<CurrentProfileContextType | null>(
  null,
);

export function CurrentProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [hasSetInitialProfile, setHasSetInitialProfile] = useState(false);

  return (
    <CurrentProfileContext.Provider
      value={{
        currentProfileId,
        setCurrentProfileId,
        hasSetInitialProfile,
        setHasSetInitialProfile,
      }}
    >
      {children}
    </CurrentProfileContext.Provider>
  );
}

export function useCurrentProfileState() {
  const context = useContext(CurrentProfileContext);
  if (!context) {
    throw new Error(
      "useCurrentProfileState must be used within CurrentProfileProvider",
    );
  }
  return context;
}
