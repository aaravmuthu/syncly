import {
  Coffee,
  Dumbbell,
  Film,
  Mountain,
  PartyPopper,
  Plane,
  ShoppingBag,
  Sofa,
  Sparkles,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/** Vector icon per plan category — replaces raw unicode emoji badges. */
const MAP: Record<string, LucideIcon> = {
  dinner: Utensils,
  hangout: Sofa,
  concert: Ticket,
  trip: Plane,
  party: PartyPopper,
  movie: Film,
  shopping: ShoppingBag,
  sports: Dumbbell,
  daytrip: Mountain,
  roadtrip: Mountain,
  boba: Coffee,
  cafe: Coffee,
  custom: Sparkles,
};

export function categoryIcon(id: string | null | undefined): LucideIcon {
  return (id && MAP[id]) || Sparkles;
}
