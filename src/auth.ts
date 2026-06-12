import type { Provider } from "next-auth/providers";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Spotify from "next-auth/providers/spotify";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { spotifyPublicEnabled } from "@/lib/spotify-api";

const providers: Provider[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  );
}

if (spotifyPublicEnabled()) {
  providers.push(
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "user-top-read user-read-recently-played",
        },
      },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/entrar",
  },
  session: { strategy: "database" },
  trustHost: true,
});

export function authConfigured(): boolean {
  return providers.length > 0 && Boolean(process.env.AUTH_SECRET);
}

export function spotifyAuthConfigured(): boolean {
  return spotifyPublicEnabled();
}
