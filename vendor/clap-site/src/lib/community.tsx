import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegalPolicy } from "./legal";

export const COMMUNITY_API = "/api";
export type Account = { id: string; username: string; description: string; email: string | null; admin: boolean; hasPassword: boolean; providers: string[]; avatar: string | null };
export type AuthConfig = { google: boolean; discord: boolean; reset: boolean; legal?: LegalPolicy;
  captcha?: { available: boolean; siteKey: string | null; loginRequired: boolean } };
export type FilmActivity = { ratingAverage: number | null; ratingCount: number; userRating: number; totalComments: number;
  comments: { id: number; body: string; created: number; authorId: string; username: string; avatar: string | null; canDelete: boolean }[]; next: number | null };

export async function communityRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${COMMUNITY_API}${path}`, { credentials: "same-origin", cache: "no-store", signal,
    ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json", "X-Clap-Request": "1" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || "Le service est temporairement indisponible."), {
    captchaRequired: result.captchaRequired === true,
  });
  return result;
}

const AuthContext = createContext<{
  user: Account | null; loading: boolean; error: boolean; refresh: () => Promise<unknown>;
}>({ user: null, loading: true, error: false, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["account"], queryFn: ({ signal }) => communityRequest<{ user: Account | null }>("/auth/me", undefined, signal), retry: 1 });
  const [identity, setIdentity] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (query.data) {
      const next = query.data.user?.id || null;
      if (identity !== undefined && identity !== next) {
        client.removeQueries({ queryKey: ["film-activity"] });
        client.removeQueries({ queryKey: ["admin-users"] });
      }
      setIdentity(next);
    }
  }, [query.data, identity, client]);
  return <AuthContext.Provider value={{ user: query.data?.user || null, loading: query.isPending,
    error: query.isError, refresh: () => query.refetch() }}>{children}</AuthContext.Provider>;
}
export const useAccount = () => useContext(AuthContext);
