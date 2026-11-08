import dictionary from './ui.en.json';
import type { ReactNode } from 'react';
import type { Lang } from './translations';

let fallbackLanguage: Lang = 'fr';
export function getLanguage(): Lang {
  try { return localStorage.getItem('clap-lang') === 'en' ? 'en' : 'fr'; } catch { return fallbackLanguage; }
}
export function saveLanguage(language: Lang) {
  fallbackLanguage = language;
  try { localStorage.setItem('clap-lang', language); } catch { /* Keep the choice in memory when storage is unavailable. */ }
}
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fragments = Object.entries(dictionary).filter(([key]) => key.length >= 5 && key.length < 150).sort((a, b) => b[0].length - a[0].length);
const words = new Map(Object.entries(dictionary).map(([key, value]) => [normalize(key), value]));
const entities: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': '\u00a0', '&lt;': '<', '&gt;': '>', '&#183;': '·' };
/** Translate interface text at display/export boundaries, preserving stored game data. */
export function localizeText<T>(value: T): T {
  if (typeof value !== 'string') return value;
  const source = value.replace(/&(amp|quot|apos|nbsp|lt|gt|#183);/g, entity => entities[entity] || entity);
  if (getLanguage() !== 'en') return source as T;
  const normalized = source.replace(/\s+/g, ' ').trim();
  const exact = (dictionary as Record<string, string>)[normalized];
  if (exact) return source.replace(source.trim(), exact) as T;
  const core = normalized.replace(/\s*[:：]\s*$/, '');
  const translated = words.get(normalize(core));
  if (!translated) {
    let result = normalized;
    for (const [fr, en] of fragments) {
      if (normalize(result).startsWith(normalize(fr) + ' ')) { result = en + result.slice(fr.length); break; }
    }
    for (const [fr, en] of fragments) {
      if (normalize(result).endsWith(' ' + normalize(fr))) { result = result.slice(0, -fr.length) + en; break; }
    }
    if (normalized === normalized.toUpperCase()) result = result.toUpperCase();
    return source.replace(source.trim(), result) as T;
  }
  const rendered = core === core.toUpperCase() ? translated.toUpperCase() : translated;
  return source.replace(source.trim(), rendered + (normalized.endsWith(':') ? ' :' : '')) as T;
}
export function localizeNode<T extends ReactNode>(value: T): T {
  return (typeof value === 'string' ? localizeText(value) : Array.isArray(value) ? value.map(localizeNode) : value) as T;
}
