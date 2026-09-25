import { supabase } from "@/integrations/supabase/client";

type OAuthClient = { name?: string; client_name?: string };

export type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

/** Supabase OAuth server helpers are not yet in the generated client types. */
export const oauth = (): OAuthApi => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
