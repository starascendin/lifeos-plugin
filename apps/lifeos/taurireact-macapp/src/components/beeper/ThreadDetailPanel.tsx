import { useBeeper } from "@/lib/contexts/BeeperContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  User,
  X,
  Briefcase,
  Building2,
  MessageSquare,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { Id } from "@holaai/convex";

interface ThreadDetailPanelProps {
  onClose: () => void;
}

export function ThreadDetailPanel({ onClose }: ThreadDetailPanelProps) {
  const {
    selectedThread,
    isThreadBusiness,
    markAsBusiness,
    getThreadBusinessNote,
  } = useBeeper();

  const [businessNote, setBusinessNote] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [personPopoverOpen, setPersonPopoverOpen] = useState(false);

  // Fetch synced thread data from Convex
  const syncedThreads = useQuery(api.lifeos.beeper.getAllThreads, {});
  const clients = useQuery(api.lifeos.pm_clients.getClients, { status: "active" });
  const people = useQuery(api.lifeos.frm_people.getPeople, {});
  const linkToClient = useMutation(api.lifeos.beeper.linkThreadToClient);
  const linkToPerson = useMutation(api.lifeos.beeper.linkThreadToPerson);

  // Get current thread's synced data
  const syncedThread = syncedThreads?.find(
    (t) => t.threadId === selectedThread?.thread_id
  );
  const linkedClientId = syncedThread?.linkedClientId;
  const linkedClient = clients?.find((c) => c._id === linkedClientId);
  const linkedPersonId = syncedThread?.linkedPersonId;
  const linkedPerson = people?.find((p) => p._id === linkedPersonId);

  // Get business status
  const isBusiness = selectedThread
    ? isThreadBusiness(selectedThread.thread_id)
    : false;

  // Load business note when thread changes
  useEffect(() => {
    if (selectedThread) {
      const note = getThreadBusinessNote(selectedThread.thread_id);
      setBusinessNote(note || "");
    }
  }, [selectedThread, getThreadBusinessNote]);

  if (!selectedThread) {
    return null;
  }

  const handleBusinessToggle = (checked: boolean) => {
    markAsBusiness(selectedThread.thread_id, checked, businessNote || undefined);
  };

  const handleNoteBlur = () => {
    if (isBusiness) {
      markAsBusiness(selectedThread.thread_id, true, businessNote || undefined);
    }
  };

  const handleClientSelect = async (clientId: string | null) => {
    try {
      await linkToClient({
        threadId: selectedThread.thread_id,
        clientId: clientId as Id<"lifeos_pmClients"> | undefined,
      });
    } catch (error) {
      console.error("Failed to link thread to client:", error);
    }
    setClientPopoverOpen(false);
  };

  const handlePersonSelect = async (personId: string | null) => {
    try {
      await linkToPerson({
        threadId: selectedThread.thread_id,
        personId: personId as Id<"lifeos_frmPeople"> | undefined,
      });
    } catch (error) {
      console.error("Failed to link thread to person:", error);
    }
    setPersonPopoverOpen(false);
  };

  return (
    <div className="h-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium">Thread Details</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Thread info */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
              selectedThread.thread_type === "group"
                ? "bg-green-500/10 text-green-500"
                : "bg-blue-500/10 text-blue-500"
            )}
          >
            {selectedThread.thread_type === "group" ? (
              <Users className="w-6 h-6" />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{selectedThread.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedThread.thread_type === "group" ? "Group" : "Direct Message"}
              {" · "}
              {selectedThread.message_count.toLocaleString()} messages
              {selectedThread.thread_type === "group" &&
                ` · ${selectedThread.participant_count} members`}
            </p>
          </div>
        </div>

        {/* Business toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-500" />
              <Label htmlFor="business-toggle" className="text-sm font-medium">
                Business Chat
              </Label>
            </div>
            <Switch
              id="business-toggle"
              checked={isBusiness}
              onCheckedChange={handleBusinessToggle}
            />
          </div>
          {isBusiness && (
            <Textarea
              placeholder="Add a note about this business chat..."
              value={businessNote}
              onChange={(e) => setBusinessNote(e.target.value)}
              onBlur={handleNoteBlur}
              className="text-sm resize-none"
              rows={2}
            />
          )}
        </div>

        {/* Link to Client */}
        {isBusiness && syncedThread && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <Label className="text-sm font-medium">Linked Client</Label>
            </div>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm h-9"
                >
                  {linkedClient ? (
                    <>
                      <Building2 className="w-4 h-4 mr-2" />
                      {linkedClient.name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Select a client...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList>
                    <CommandEmpty>No clients found</CommandEmpty>
                    {linkedClientId && (
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => handleClientSelect(null)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove link
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup heading="Clients">
                      {clients?.map((client) => (
                        <CommandItem
                          key={client._id}
                          value={client.name}
                          onSelect={() => handleClientSelect(client._id)}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          <span className="flex-1 truncate">{client.name}</span>
                          {linkedClientId === client._id && (
                            <Check className="h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Link to Person/Contact - available for all synced threads */}
        {syncedThread && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-500" />
              <Label className="text-sm font-medium">Linked Contact</Label>
            </div>
            <Popover open={personPopoverOpen} onOpenChange={setPersonPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm h-9"
                >
                  {linkedPerson ? (
                    <>
                      <span className="mr-2">{linkedPerson.avatarEmoji || "👤"}</span>
                      {linkedPerson.name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Select a contact...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search contacts..." />
                  <CommandList>
                    <CommandEmpty>No contacts found</CommandEmpty>
                    {linkedPersonId && (
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => handlePersonSelect(null)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove link
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup heading="Contacts">
                      {people?.map((person) => (
                        <CommandItem
                          key={person._id}
                          value={person.name}
                          onSelect={() => handlePersonSelect(person._id)}
                        >
                          <span className="mr-2">{person.avatarEmoji || "👤"}</span>
                          <span className="flex-1 truncate">{person.name}</span>
                          {linkedPersonId === person._id && (
                            <Check className="h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Thread not synced warning */}
        {isBusiness && !syncedThread && (
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 text-xs">
            <p className="font-medium mb-1">Thread not synced to cloud</p>
            <p className="text-amber-600/80">
              Click "Sync to Cloud" in the header to sync business threads before linking to clients.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stats
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-lg font-semibold">
                {selectedThread.message_count.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </div>
            {selectedThread.thread_type === "group" && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold">
                  {selectedThread.participant_count}
                </div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
