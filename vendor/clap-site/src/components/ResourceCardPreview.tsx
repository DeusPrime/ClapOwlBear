import { memo } from "react";
import type { Figurant } from "@/lib/figurants";
import type { KeyRole } from "@/lib/keyRoles";
import type { Power } from "@/lib/powers";
import type { Profile } from "@/lib/profiles";
import type { Vehicle } from "@/lib/vehicles";
import FigurantCard from "./FigurantCard";
import KeyRoleCard from "./KeyRoleCard";
import PowerCard from "./PowerCard";
import ProfileCard from "./ProfileCard";
import VehicleCard from "./VehicleCard";
import LazyResourcePreview from "./LazyResourcePreview";

export type PreviewResource =
  | { type: "figurant"; item: Figurant }
  | { type: "key-role"; item: KeyRole }
  | { type: "power"; item: Power }
  | { type: "profile"; item: Profile }
  | { type: "vehicle"; item: Vehicle };

// Selection, dialogs and hero rolls must not recalculate every card's text fit.
export default memo(function ResourceCardPreview({ resource }: { resource: PreviewResource }) {
  return <LazyResourcePreview render={() => {
    switch (resource.type) {
      case "figurant": return <FigurantCard figurant={resource.item} />;
      case "key-role": return <KeyRoleCard role={resource.item} />;
      case "power": return <PowerCard power={resource.item} />;
      case "profile": return <ProfileCard profile={resource.item} />;
      case "vehicle": return <VehicleCard vehicle={resource.item} />;
    }
  }} />;
});
