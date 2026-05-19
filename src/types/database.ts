export type Role = "admin" | "player";

export type Phase =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: Role;
  is_approved: boolean;
  whatsapp_group_optin: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  match_number: number;
  phase: Phase;
  group_letter: string | null;
  home_team: string;
  away_team: string;
  home_is_placeholder: boolean;
  away_is_placeholder: boolean;
  kickoff_at: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
}

export interface Entry {
  id: string;
  user_id: string;
  name: string;
  paid: boolean;
  created_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  entry_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
}

