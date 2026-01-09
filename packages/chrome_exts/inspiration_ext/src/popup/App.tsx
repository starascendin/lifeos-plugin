import { useAuth } from "@clerk/chrome-extension";
import { AuthGate } from "./components/AuthGate";
import { SignIn } from "./components/SignIn";
import { SaveForm } from "./components/SaveForm";
import { InspirationList } from "./components/InspirationList";
import { useState } from "react";

type View = "save" | "list";

export default function App() {
  const { isSignedIn, isLoaded } = useAuth();
  const [view, setView] = useState<View>("save");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignIn />;
  }

  return (
    <AuthGate>
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView("save")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              view === "save"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Save Page
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            My Inspirations
          </button>
        </div>

        {view === "save" ? <SaveForm /> : <InspirationList />}
      </div>
    </AuthGate>
  );
}
