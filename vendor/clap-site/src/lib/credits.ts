import seed from "../../server/credits-seed.json";
import { useQuery } from "@tanstack/react-query";
import { communityRequest } from "./community";
export type CreditsDocument = Omit<typeof seed, "sections"> & {
  sections: { role: string; role_en?: string; names: string[] }[];
};
export const DEFAULT_CREDITS: CreditsDocument = seed;
export const useCredits = () => useQuery({
  queryKey: ["content", "credits"],
  queryFn: () => communityRequest<CreditsDocument>("/credits"),
  refetchInterval: 60000,
});
