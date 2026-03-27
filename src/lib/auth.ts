import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import type { OAuthConfig } from "next-auth/providers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDefaultConfig } from "@/lib/attributes";
import { grantCredits } from "@/lib/credits";
import { TIER_CREDITS } from "@/lib/constants";

const Amazon: OAuthConfig<{
  user_id: string;
  name: string;
  email: string;
}> = {
  id: "amazon",
  name: "Amazon",
  type: "oauth",
  authorization: {
    url: "https://www.amazon.com/ap/oa",
    params: { scope: "profile" },
  },
  token: "https://api.amazon.com/auth/o2/token",
  userinfo: "https://api.amazon.com/user/profile",
  profile(profile) {
    return {
      id: profile.user_id,
      name: profile.name,
      email: profile.email,
    };
  },
  clientId: process.env.AUTH_AMAZON_ID,
  clientSecret: process.env.AUTH_AMAZON_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Apple({ allowDangerousEmailAccountLinking: true }),
    { ...Amazon, allowDangerousEmailAccountLinking: true },
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "database",
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await Promise.all([
        prisma.attributeConfig.create({
          data: {
            userId: user.id,
            config: buildDefaultConfig() as unknown as Prisma.InputJsonValue,
          },
        }),
        grantCredits(user.id, TIER_CREDITS.FREE, "Welcome bonus (FREE tier)", {
          source: "SIGNUP_GRANT",
          expiresAt: null,
          priority: 1,
        }),
      ]);
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
