#!/bin/bash
# Patch iOS Info.plist with required ATS exceptions after cap sync

PLIST_PATH="ios/App/App/Info.plist"

if [ ! -f "$PLIST_PATH" ]; then
  echo "Error: Info.plist not found at $PLIST_PATH"
  exit 1
fi

echo "Patching iOS Info.plist with ATS exceptions..."

# Use PlistBuddy to add ATS exceptions
/usr/libexec/PlistBuddy -c "Delete :NSAppTransportSecurity" "$PLIST_PATH" 2>/dev/null || true

/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSExceptionDomains dict" "$PLIST_PATH"

# Add exception for Tailscale domain
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSExceptionDomains:tail05d28.ts.net dict" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSExceptionDomains:tail05d28.ts.net:NSExceptionAllowsInsecureHTTPLoads bool true" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSExceptionDomains:tail05d28.ts.net:NSIncludesSubdomains bool true" "$PLIST_PATH"

echo "Done! ATS exceptions added to Info.plist"
