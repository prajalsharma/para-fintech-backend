import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { AuthResponse, SignupRequest, LoginRequest } from "../types";

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

export const supabaseService = {
  /**
   * Sign up a new user with Supabase Auth
   * Returns user ID and JWT token
   */
  async signup(request: SignupRequest): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
      email: request.email,
      password: request.password,
    });

    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error("Signup failed: No user or session returned");
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      session: {
        access_token: data.session.access_token,
        token_type: "Bearer",
      },
    };
  },

  /**
   * Login existing user
   * Returns JWT token
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: request.email,
      password: request.password,
    });

    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error("Login failed: Invalid credentials");
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      session: {
        access_token: data.session.access_token,
        token_type: "Bearer",
      },
    };
  },

  /**
   * Verify JWT token and extract user ID
   */
  async verifyToken(
    token: string
  ): Promise<{ userId: string; email: string }> {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new Error("Invalid or expired token");
    }

    return {
      userId: data.user.id,
      email: data.user.email!,
    };
  },
};
