import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { CheckCircle, Clock, Loader2, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RequestCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestCreditsModal({
  open,
  onOpenChange,
}: RequestCreditsModalProps) {
  const credits = useQuery(api.common.credits.getMyCredits);
  const pendingRequest = useQuery(api.common.credits.getMyPendingRequest);
  const requestCredits = useMutation(api.common.credits.requestCredits);

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestCredits({ message: message.trim() });
      toast.success("Credit request submitted successfully");
      setMessage("");
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error("Failed to submit credit request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show pending request status
  if (pendingRequest) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Request Pending
            </DialogTitle>
            <DialogDescription>
              Your credit request is being reviewed by an administrator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground mb-1">
                Your message:
              </div>
              <p className="text-sm">
                {pendingRequest.message || "No message provided"}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Submitted on{" "}
              {new Date(pendingRequest.createdAt).toLocaleDateString()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request AI Credits</DialogTitle>
          <DialogDescription>
            Submit a request to get AI credits for using LifeOS features.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Current balance display */}
          {credits && (
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm text-muted-foreground">
                Current Balance
              </span>
              <span className="font-semibold">
                {credits.balance.toLocaleString()} credits
              </span>
            </div>
          )}

          {/* Request form */}
          <div className="space-y-2">
            <Label htmlFor="message">Reason for request</Label>
            <Textarea
              id="message"
              placeholder="Tell us why you'd like to get AI credits..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Your request will be reviewed by an administrator who will grant
              credits based on your usage needs.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Component to show credit request status in a card format
export function CreditRequestStatus() {
  const requests = useQuery(api.common.credits.getMyRequests, {});

  if (!requests || requests.length === 0) {
    return null;
  }

  const latestRequest = requests[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "denied":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending Review";
      case "approved":
        return "Approved";
      case "denied":
        return "Denied";
      default:
        return status;
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Latest Credit Request</span>
        <div className="flex items-center gap-1.5 text-sm">
          {getStatusIcon(latestRequest.status)}
          <span>{getStatusText(latestRequest.status)}</span>
        </div>
      </div>
      {latestRequest.status === "approved" && latestRequest.creditsGranted && (
        <p className="text-sm text-green-600">
          +{latestRequest.creditsGranted.toLocaleString()} credits granted
        </p>
      )}
      {latestRequest.status === "denied" && latestRequest.adminResponse && (
        <p className="text-sm text-muted-foreground">
          {latestRequest.adminResponse}
        </p>
      )}
    </div>
  );
}
