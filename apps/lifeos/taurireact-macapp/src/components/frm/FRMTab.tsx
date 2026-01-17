import { useParams, useNavigate } from "react-router-dom";
import { useFRM } from "@/lib/contexts/FRMContext";
import { PeopleList } from "./people/PeopleList";
import { PersonDetail } from "./people/PersonDetail";
import { TimelineView } from "./timeline/TimelineView";
import { Button } from "@/components/ui/button";
import { Users, Clock } from "lucide-react";
import { useEffect } from "react";
import type { Id } from "@holaai/convex";

type TabType = "people" | "timeline";

export function FRMTab() {
  const { tab, id } = useParams<{ tab?: string; id?: string }>();
  const navigate = useNavigate();
  const { selectedPersonId, setSelectedPersonId } = useFRM();

  // Determine current tab from URL
  const currentTab: TabType = tab === "timeline" ? "timeline" : "people";

  // Check if we're viewing a specific person
  const isPersonDetail = currentTab === "people" && id;
  const personId = isPersonDetail ? (id as Id<"lifeos_frmPeople">) : undefined;

  // Sync URL with selected person using useEffect to avoid setState during render
  useEffect(() => {
    if (personId && personId !== selectedPersonId) {
      setSelectedPersonId(personId);
    }
  }, [personId, selectedPersonId, setSelectedPersonId]);

  const handleTabChange = (newTab: TabType) => {
    setSelectedPersonId(null);
    if (newTab === "people") {
      navigate("/lifeos/frm/people");
    } else {
      navigate("/lifeos/frm/timeline");
    }
  };

  const handlePersonSelect = (personId: Id<"lifeos_frmPeople">) => {
    setSelectedPersonId(personId);
    navigate(`/lifeos/frm/people/${personId}`);
  };

  const handleBackToList = () => {
    setSelectedPersonId(null);
    navigate("/lifeos/frm/people");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Relationships</h1>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant={currentTab === "people" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("people")}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              People
            </Button>
            <Button
              variant={currentTab === "timeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("timeline")}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Timeline
            </Button>
          </div>
        </div>

{/* Actions removed - now in PeopleList header */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentTab === "people" && !isPersonDetail && (
          <PeopleList onPersonSelect={handlePersonSelect} />
        )}
        {currentTab === "people" && isPersonDetail && personId && (
          <PersonDetail personId={personId} onBack={handleBackToList} />
        )}
        {currentTab === "timeline" && <TimelineView />}
      </div>
    </div>
  );
}
