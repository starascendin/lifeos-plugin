// This file is used for Clerk JWT authentication
// The CLERK_JWT_ISSUER_DOMAIN environment variable must be set in the Convex dashboard
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
