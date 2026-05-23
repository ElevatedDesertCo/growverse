export type BuildingType =
  | "growTent"
  | "bloomExtractor"
  | "amberForge"
  | "thornTrap";

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  imagePath: string | null;
  color: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  growTent: {
    type: "growTent",
    name: "Grow Tent",
    description: "Cultivates sacred cannabis. Produces Leaf at harvest.",
    imagePath: null,
    color: "#7fb069",
  },
  bloomExtractor: {
    type: "bloomExtractor",
    name: "Bloom Extractor",
    description: "Multiplies harvest yield from nearby Grow Tents.",
    imagePath: "/buildings/bloom-extractor.png",
    color: "#d4a04a",
  },
  amberForge: {
    type: "amberForge",
    name: "Amber Forge",
    description: "Passively generates Fire over time.",
    imagePath: "/buildings/amber-forge.png",
    color: "#e8964c",
  },
  thornTrap: {
    type: "thornTrap",
    name: "Thorn Trap",
    description: "A vigilant defensive plant. Guards the base.",
    imagePath: "/buildings/thorn-trap.png",
    color: "#a875d4",
  },
};

export const BUILDING_TYPES: BuildingType[] = [
  "growTent",
  "bloomExtractor",
  "amberForge",
  "thornTrap",
];
