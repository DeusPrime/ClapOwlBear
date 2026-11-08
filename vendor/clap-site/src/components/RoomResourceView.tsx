import { localizeNode } from '@/i18n/localize';
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import KeyRoleCard from "./KeyRoleCard";
import FigurantCard from "./FigurantCard";
import PowerCard from "./PowerCard";
import ProfileCard from "./ProfileCard";
import VehicleCard from "./VehicleCard";
import RollDialog, { type RollSelection } from "./RollDialog";
import type { BundledResource } from "@/lib/resourceBundle";
import RoomActorLinks from "./RoomActorLinks";
export default function RoomResourceView({ resource, onClose }: { resource: BundledResource; onClose: () => void }) {
  const [selection, setSelection] = useState<RollSelection[]>([]);
  const [rolling, setRolling] = useState(false);
  const openRoll = (facet: string, name: string, value: string) => { setSelection([{ facet, name, value: Number.parseInt(value, 10) || 0 }]); setRolling(true); };
  return <>
    <Dialog open onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto bg-paper"><DialogTitle className="pr-6 font-display text-3xl">{resource.item.titre || "Carte"}</DialogTitle><DialogDescription>{localizeNode(resource.type === "key-role" || resource.type === "figurant" ? "Clique sur une valeur pour lancer un jet." : "Carte liée à la partie.")}</DialogDescription><div className="overflow-x-auto pb-3"><div className="mx-auto w-fit">
      {localizeNode(resource.type === "key-role" ? <KeyRoleCard role={resource.item} scale={0.66} onFacetRoll={facet => openRoll(facet, facet[0].toUpperCase() + facet.slice(1), resource.item[facet])} /> : resource.type === "figurant" ? <FigurantCard figurant={resource.item} scale={0.66} onPotentialRoll={() => openRoll("potentiel", "Potentiel", resource.item.potentiel)} /> : resource.type === "profile" ? <ProfileCard profile={resource.item} scale={0.66} /> : resource.type === "power" ? <PowerCard power={resource.item} scale={0.66} /> : <VehicleCard vehicle={resource.item} scale={0.66} />)}
    </div></div>{localizeNode((resource.type === "key-role" || resource.type === "figurant") && <RoomActorLinks key={`${resource.type}:${resource.item.id}`} actor={resource} />)}</DialogContent></Dialog>
    <RollDialog figurantGroup={resource.type === "figurant"} cardPotential open={rolling} onOpenChange={setRolling} selection={selection} destinDiceCount={resource.type === "figurant" ? 0 : 1} simple contextLabel={resource.item.titre || "Carte"} />
  </>;
}
