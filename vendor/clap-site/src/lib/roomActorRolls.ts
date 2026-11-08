import { FACET_LABELS, FACET_SKILLS, type Facet } from "./characters";
import type { BundledResource } from "./resourceBundle";
import type { RollSelection } from "@/components/RollDialog";

export type RoomActor = Extract<BundledResource, { type: "key-role" | "figurant" }>;
export type RoomActorEquipment = Extract<BundledResource, { type: "power" | "vehicle" }>;
const number = (value: string) => Number.parseFloat(value) || 0;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function roomActorRoll(actor: RoomActor, equipment: RoomActorEquipment, facet: Facet = "corps", stat: "maniabilite" | "vitesse" = "maniabilite"): RollSelection[] {
  if (equipment.type === "power" && actor.type === "key-role") {
    const attribute = normalize(equipment.item.attribut);
    const match = (Object.keys(FACET_SKILLS) as Facet[]).find(key => normalize(FACET_LABELS[key]) === attribute || FACET_SKILLS[key].some(skill => normalize(skill) === attribute));
    if (!match) throw new Error("L’attribut de ce pouvoir ne correspond à aucun aspect. Modifie le pouvoir avant de l’utiliser.");
    facet = match;
  }
  const source = actor.type === "figurant"
    ? { facet: "potentiel", name: "Potentiel", value: number(actor.item.potentiel) }
    : { facet, name: FACET_LABELS[facet], value: number(actor.item[facet]) };
  return equipment.type === "power" ? [source] : [
    { facet: "vehicle", name: stat === "maniabilite" ? "Maniabilité" : "Vitesse", value: number(equipment.item[stat]) },
    { ...source, name: `${source.name} / 2`, value: source.value / 2 },
  ];
}
