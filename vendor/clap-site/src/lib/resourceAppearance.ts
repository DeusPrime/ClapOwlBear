import type { ResourceKind } from "./dataValidation";

export const DEFAULT_RESOURCE_BACK_IMAGES: Record<ResourceKind, string> = {
  figurant: `${import.meta.env.BASE_URL}resource-backs/figurant.png`,
  power: `${import.meta.env.BASE_URL}resource-backs/power.png`,
  profile: `${import.meta.env.BASE_URL}resource-backs/profile.png`,
  "key-role": `${import.meta.env.BASE_URL}resource-backs/key-role.png`,
  vehicle: `${import.meta.env.BASE_URL}resource-backs/vehicle.png`,
};

export const RESOURCE_APPEARANCE: Record<ResourceKind, { label: string; color: string }> = {
  "key-role": { label: "Rôle clé", color: "#570211" },
  figurant: { label: "Figurant", color: "#3a1b0c" },
  profile: { label: "Profil", color: "#005045" },
  power: { label: "Pouvoir", color: "#032C4D" },
  vehicle: { label: "Véhicule", color: "#87330f" },
};
