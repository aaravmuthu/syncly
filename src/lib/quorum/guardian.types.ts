/** Shared, client-safe shapes for the guardian dashboard. */

export type TeenCard = {
  id: string;
  name: string;
  emoji: string;
  avatar_url: string | null;
  school: string | null;
  curfew: string | null;
  sharing: boolean;
  home: { address: string | null; lat: number | null; lon: number | null };
  location: {
    lat: number;
    lon: number;
    accuracy_m: number | null;
    battery_pct: number | null;
    at: string;
  } | null;
  status: { label: string; emoji: string; tone: "good" | "accent" | "neutral" };
  zones: { id: string; label: string; kind: string; lat: number; lon: number; radius_m: number }[];
  plans: {
    id: string;
    title: string;
    category: string;
    status: string;
    window_start: string | null;
    window_end: string | null;
    est_cost_min: number | null;
    est_cost_max: number | null;
    adult_supervised: boolean;
    supervision_note: string | null;
    group_name: string;
    venue: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
    drive_minutes: number | null;
    rides: {
      id: string;
      car_label: string;
      leg: string;
      driver_name: string;
      driver_avatar: string | null;
      driver_emoji: string | null;
      driver_phone: string | null;
      vehicle: string | null;
      plate: string | null;
      passengers: number;
      departed_at: string | null;
      eta_minutes: number | null;
      carries_my_teen: boolean;
    }[];
    attendees: { profile_id: string; name: string; emoji: string; avatar_url: string | null }[];
    parentNetwork: {
      id: string;
      name: string;
      emoji: string;
      avatar_url: string | null;
      relation: string;
      teen_name: string;
      phone: string | null;
    }[];
    approval: {
      id: string;
      status: string;
      condition_text: string | null;
      /** Who answered: the guardian in this hub, or whoever opened a shared link. */
      decided_via: "guardian" | "link" | null;
    } | null;
  }[];
  delays: {
    id: string;
    reason: string;
    minutes: number;
    new_eta: string | null;
    created_at: string;
  }[];
  checkins: {
    id: string;
    status: string;
    note: string | null;
    lat: number | null;
    lon: number | null;
    place_label: string | null;
    created_at: string;
    responded_at: string | null;
  }[];
};
