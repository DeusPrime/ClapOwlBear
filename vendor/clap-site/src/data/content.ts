import { useQuery } from "@tanstack/react-query";
import type { NewsItem } from "./news";

const API = (import.meta.env.VITE_CONTENT_API_URL || "/api").replace(/\/$/, "");

export type Film = {
  code: string;
  year: string;
  title_fr: string;
  title_en: string;
  genre_fr: string;
  genre_en: string;
  pitch_fr: string;
  pitch_en: string;
  rating: string;
  ratingAverage: number | null;
  ratingCount: number;
  duration: string;
  poster?: string;
  palette: string;
  intro: boolean;
  released: boolean;
};

function useContent<T>(collection: "news" | "films") {
  return useQuery<T[]>({
    queryKey: ["content", collection],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API}/${collection}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Content unavailable");
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

export const useNews = () => useContent<NewsItem>("news");
export const useFilms = () => useContent<Film>("films");
