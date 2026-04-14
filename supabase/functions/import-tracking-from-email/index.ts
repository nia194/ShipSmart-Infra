// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOL: TRACKING NUMBER IMPORT FROM CONFIRMATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
//
// USE CASE:
//   After a user books on the carrier/provider website, they receive a
//   confirmation email with a tracking number. Currently, they'd have to
//   manually copy the carrier name and tracking number back into the app.
//   This tool eliminates that friction by reading the confirmation email,
//   extracting the tracking details, and auto-attaching them to the saved
//   shipment — enabling automatic tracking without manual data entry.
//
// WHY MCP:
//   Expose as an MCP tool so the AI agent can:
//   - Prompt the user: "Want me to check your email for a tracking number?"
//   - Automatically detect booking confirmation emails
//   - Extract and attach tracking without user doing manual copy-paste
//   The agent orchestrates the flow; the tool handles email access + parsing.
//
// TOOL SIGNATURE:
//   Name: import_tracking_from_email
//   Input: {
//     userId: string,                    // authenticated user ID
//     savedOptionId?: string,            // optional: link to specific saved_options row
//     emailSource: "gmail" | "outlook",  // which email provider to check
//     searchQuery?: string,              // optional: custom search (default: recent shipping confirmations)
//     maxResults?: number,               // default: 5
//   }
//   Output: {
//     found: boolean,
//     trackingDetails: Array<{
//       carrier: string,                 // "UPS" | "FedEx" | "DHL" | "USPS" etc.
//       trackingNumber: string,
//       emailSubject: string,
//       emailDate: string,               // ISO date
//       bookingReference?: string,
//       estimatedDelivery?: string,
//       linkedSavedOptionId?: string,     // if auto-matched to a saved option
//     }>,
//     rawEmailSnippets?: string[],       // for debugging / user confirmation
//   }
//
// APPROACH:
//   1. Authenticate with user's email via MCP email connector
//      - Gmail: Use Gmail MCP connector (OAuth2 scopes: gmail.readonly)
//      - Outlook: Use Microsoft Graph MCP connector (Mail.Read scope)
//
//   2. Search for recent shipping confirmation emails:
//      - Gmail search query: "from:(ups OR fedex OR dhl OR lugless OR luggagetoship)
//        subject:(confirmation OR tracking OR shipment) newer_than:7d"
//      - Graph API filter: equivalent OData filter on receivedDateTime and subject
//
//   3. For each matching email, extract tracking info using pattern matching:
//      - UPS: 1Z[A-Z0-9]{16} (18 chars starting with 1Z)
//      - FedEx: \d{12,22} (12-22 digit numbers, context-dependent)
//      - DHL: \d{10,11} (10-11 digit numbers for DHL Express)
//      - USPS: \d{20,22} or specific format patterns
//      - Also check for HTML tracking links containing tracking numbers
//      - Parse structured data from email body (carrier-specific templates)
//
//   4. If AI parsing is needed for ambiguous emails:
//      - Call ai-shipping-advisor or inline LLM to extract structured data
//      - Prompt: "Extract carrier name, tracking number, and booking reference
//        from this shipping confirmation email"
//      - Use tool calling for structured output extraction
//
//   5. Auto-match to saved options:
//      - Compare extracted carrier + route against user's saved_options
//      - If a match is found (same carrier, similar dates), link automatically
//      - If multiple potential matches, return all and let user/agent choose
//
//   6. Store tracking info:
//      - Update saved_options row with tracking_number, carrier fields
//      - Or create a new tracking entry in a `shipment_tracking` table
//      - Begin polling carrier tracking APIs for status updates
//
// INTEGRATION POINTS:
//   - SavedPage (src/pages/SavedPage.tsx):
//     Add "Import tracking from email" button for each saved option
//     that doesn't yet have a tracking number
//   - Post-booking flow: After user clicks "Book" and is redirected to
//     carrier site, show a "Check for tracking number" prompt after
//     a reasonable delay (e.g. 5 minutes or on next visit)
//   - Notifications: Once tracking is imported, start sending status
//     updates via ai-notification-generator
//   - AI agent: Agent can proactively ask "I see you booked with FedEx
//     yesterday — want me to check your email for the tracking number?"
//
// MCP CONNECTORS NEEDED:
//   - Gmail connector: For Google Workspace / personal Gmail users
//     - Scopes: gmail.readonly (read-only access to email)
//     - Connect via: standard_connectors--connect (connector_id: "gmail")
//   - Microsoft Graph connector: For Outlook / Microsoft 365 users
//     - Scopes: Mail.Read (read-only access to mail)
//     - Connect via: standard_connectors--connect (connector_id: "microsoft")
//
// PRIVACY & SECURITY:
//   - Only read emails matching shipping confirmation patterns
//   - Never store full email content — only extract tracking metadata
//   - User must explicitly authorize email access via MCP connector
//   - Show user what was extracted and ask for confirmation before linking
//   - All email access is read-only (no send/delete permissions)
//   - Log all email access for audit trail
//
// ERROR HANDLING:
//   - Email connector not linked: prompt user to connect Gmail/Outlook
//   - No matching emails found: suggest user forward the confirmation
//     email to a dedicated import address, or manual entry fallback
//   - Ambiguous tracking number: present options to user for confirmation
//   - Rate limits: Gmail API (250 quota units/second), Graph API (10k/10min)
//
// EXAMPLE:
//   Input:  { userId: "abc-123", emailSource: "gmail", maxResults: 3 }
//   Output: {
//     found: true,
//     trackingDetails: [
//       {
//         carrier: "FedEx",
//         trackingNumber: "794644790138",
//         emailSubject: "Your FedEx shipment 794644790138 is on its way",
//         emailDate: "2026-04-03T14:22:00Z",
//         bookingReference: "FXSP-2026-0403",
//         estimatedDelivery: "2026-04-06",
//         linkedSavedOptionId: "saved-opt-456"
//       }
//     ]
//   }
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, savedOptionId, emailSource, searchQuery, maxResults } = await req.json();

    if (!userId || !emailSource) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, emailSource" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement Gmail MCP connector integration (gmail.readonly)
    // TODO: Implement Microsoft Graph MCP connector integration (Mail.Read)
    // TODO: Implement email search with shipping confirmation filters
    // TODO: Implement regex-based tracking number extraction per carrier
    // TODO: Implement LLM-based extraction fallback for ambiguous emails
    // TODO: Implement auto-matching against saved_options table
    // TODO: Store extracted tracking info and begin status polling
    // TODO: Register as MCP tool "import_tracking_from_email"

    return new Response(
      JSON.stringify({
        error: "Tracking import from email not yet implemented",
        placeholder: true,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
