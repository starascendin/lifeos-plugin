import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <SignUp
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
