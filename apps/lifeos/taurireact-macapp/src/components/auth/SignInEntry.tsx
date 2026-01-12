import { isCapacitor } from "@/lib/platform";
import { SignIn } from "./SignIn";
import { CapacitorSignIn } from "./capacitor/CapacitorSignIn";

export function SignInEntry() {
  return isCapacitor ? <CapacitorSignIn /> : <SignIn />;
}

