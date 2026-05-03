export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export type AuthTokenResponse = {
  access: string;
};

export type Rating = {
  category: string;
  value: number;
  games_played: number;
  deviation: number | null;
  volatility: number | null;
  last_updated: string;
};
