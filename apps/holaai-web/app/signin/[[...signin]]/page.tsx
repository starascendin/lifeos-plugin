import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary:
              "bg-primary text-primary-foreground hover:bg-primary/90",
            card: "shadow-none",
          },
        }}
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
