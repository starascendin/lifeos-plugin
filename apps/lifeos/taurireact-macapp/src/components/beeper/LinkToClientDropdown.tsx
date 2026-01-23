import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
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
import { Button } from "@/components/ui/button";
import { Building2, Check, X } from "lucide-react";

interface LinkToClientDropdownProps {
  threadId: string;
  currentClientId?: Id<"lifeos_pmClients"> | null;
  onLinkChange?: () => void;
}

export function LinkToClientDropdown({
  threadId,
  currentClientId,
  onLinkChange,
}: LinkToClientDropdownProps) {
  const [open, setOpen] = useState(false);
  const clients = useQuery(api.lifeos.pm_clients.getClients, { status: "active" });
  const linkToClient = useMutation(api.lifeos.beeper.linkThreadToClient);

  const handleSelect = async (clientId: string | null) => {
    try {
      await linkToClient({
        threadId,
        clientId: clientId as Id<"lifeos_pmClients"> | undefined,
      });
      onLinkChange?.();
    } catch (error) {
      console.error("Failed to link thread to client:", error);
    }
    setOpen(false);
  };

  const currentClient = clients?.find((c) => c._id === currentClientId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
          <Building2 className="h-3.5 w-3.5 mr-1.5" />
          {currentClient ? currentClient.name : "Link to Client"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No clients found</CommandEmpty>
            {currentClientId && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(null)}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove client link
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Clients">
              {clients?.map((client) => (
                <CommandItem
                  key={client._id}
                  value={client.name}
                  onSelect={() => handleSelect(client._id)}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{client.name}</span>
                  {currentClientId === client._id && (
                    <Check className="h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
