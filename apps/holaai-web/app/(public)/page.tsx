import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mic, BookOpen, Trophy, MessageCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">
            HolaAI
          </Link>
          <div className="flex gap-4">
            <Link href="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">Learn Spanish with AI</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Practice speaking Spanish with our AI conversation partner. Get
            instant feedback and improve your fluency naturally.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg">Start Learning Free</Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose HolaAI?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Mic,
                title: "Voice Practice",
                description:
                  "Speak naturally and get real-time feedback on your pronunciation",
              },
              {
                icon: MessageCircle,
                title: "AI Conversations",
                description:
                  "Chat with AI tutors in realistic everyday scenarios",
              },
              {
                icon: BookOpen,
                title: "Personalized Lessons",
                description: "Learning paths adapted to your level and goals",
              },
              {
                icon: Trophy,
                title: "Track Progress",
                description:
                  "See your improvement over time with detailed analytics",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-card rounded-lg border"
              >
                <feature.icon className="h-10 w-10 mb-4 text-primary" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Start Your Spanish Journey?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of learners who are becoming fluent in Spanish with
            HolaAI.
          </p>
          <Link href="/sign-up">
            <Button size="lg">Get Started for Free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 HolaAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
