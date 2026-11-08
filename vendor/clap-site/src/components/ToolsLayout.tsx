import PageTour from "@/components/PageTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import RoleTabs from "@/components/RoleTabs";

export default function ToolsLayout({ title, children, back = false }: { title: string; children: ReactNode; back?: boolean }) {
  return <div className="min-h-screen bg-paper text-foreground">
    {localizeNode(back ? <header id="tool-editor-header" className="sticky top-0 z-20 border-b border-ink bg-paper/95 backdrop-blur" /> : <AppHeader title={localizeText(title)} />)}
    <main className={`container ${back ? "pt-8" : "pt-24 sm:pt-8"} pb-28 sm:pb-12`}>{localizeNode(!back && <RoleTabs />)}{back && <PageTour page="tool-detail" />}{children}</main>
  </div>;
}
