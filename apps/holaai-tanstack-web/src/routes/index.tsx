import { Button } from "@/components/ui/button";
import { SignInButton, SignedIn, SignedOut } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, MessageCircle, Mic, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="font-bold text-2xl">
            TanStack Demo
          </Link>
          <div className="flex gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost">Sign In</Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button>Get Started</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto text-center">
          <h1 className="mb-6 font-bold text-5xl">
            TanStack Start + Convex Demo
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-muted-foreground text-xl">
            A demo application showcasing TanStack Start with Clerk
            authentication, Convex backend, and shadcn UI components.
          </p>
          <div className="flex justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg">Get Started</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard">
                <Button size="lg">Go to Dashboard</Button>
              </Link>
            </SignedIn>
            <a href="#features">
              <Button size="lg" variant="outline">
                See Features
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/50 px-4 py-20">
        <div className="container mx-auto">
          <h2 className="mb-12 text-center font-bold text-3xl">Tech Stack</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Mic,
                title: "TanStack Start",
                description:
                  "Full-stack React framework with file-based routing",
              },
              {
                icon: MessageCircle,
                title: "Convex Backend",
                description: "Real-time database with automatic sync",
              },
              {
                icon: BookOpen,
                title: "Clerk Auth",
                description: "Complete user management and authentication",
              },
              {
                icon: Trophy,
                title: "shadcn/ui",
                description: "Beautiful, accessible UI components",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6"
              >
                <feature.icon className="mb-4 h-10 w-10 text-primary" />
                <h3 className="mb-2 font-semibold text-lg">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto text-center">
          <h2 className="mb-6 font-bold text-3xl">Ready to Explore?</h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground text-xl">
            Sign in to access the dashboard and see the full integration in
            action.
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg">Sign In to Continue</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard">
              <Button size="lg">Go to Dashboard</Button>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>TanStack Start Demo - Using @holaai/convex</p>
        </div>
      </footer>
    </div>
  );
}
