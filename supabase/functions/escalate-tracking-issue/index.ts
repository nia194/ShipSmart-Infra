// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOL: TRACKING EXCEPTION ESCALATION / SUPPORT WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────
//
// USE CASE:
//   When tracking shows exceptions — delayed, attempted delivery, delivered
//   but missing, customs hold, damage reported — users often don't know
//   what to do next. This tool automates the escalation workflow by:
//   - Diagnosing the tracking exception type
//   - Collecting relevant shipment metadata for support
//   - Drafting a support message tailored to the carrier
//   - Opening the correct carrier help/support page
//   - Optionally sending the support request via email or creating a task
//
// WHY MCP:
//   Expose as an MCP tool so the AI agent can:
//   - Detect exceptions from tracking status and proactively offer help
//   - Ask the user clarifying questions ("Was someone home for delivery?")
//   - Draft and send support communications on the user's behalf
//   - Create follow-up tasks/reminders for unresolved issues
//   The agent handles the conversational flow; the tool handles
//   carrier-specific escalation logic and support channel routing.
//
// TOOL SIGNATURE:
//   Name: escalate_tracking_issue
//   Input: {
//     userId: string,
//     trackingNumber: string,
//     carrier: string,                    // "UPS" | "FedEx" | "DHL" etc.
//     exceptionType: "DELAYED" | "ATTEMPTED_DELIVERY" | "DELIVERED_NOT_RECEIVED"
//                  | "CUSTOMS_HOLD" | "DAMAGE" | "LOST" | "ADDRESS_ISSUE" | "OTHER",
//     shipmentContext: {
//       origin: string,
//       destination: string,
//       serviceName: string,
//       dropOffDate: string,
//       expectedDeliveryDate: string,
//       actualStatus: string,             // raw tracking status text
//       savedOptionId?: string,
//     },
//     userNotes?: string,                 // additional context from user
//     actions: Array<"DRAFT_EMAIL" | "OPEN_SUPPORT_PAGE" | "CREATE_TASK" | "FILE_CLAIM">,
//   }
//   Output: {
//     diagnosis: {
//       severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
//       explanation: string,              // human-readable explanation of the issue
//       recommendedActions: string[],     // ordered list of what to do
//       estimatedResolutionTime: string,  // e.g. "1-3 business days"
//     },
//     supportDraft?: {
//       subject: string,
//       body: string,                     // pre-filled support message
//       recipientEmail: string,           // carrier support email
//       referenceNumber: string,          // claim/case reference format
//     },
//     supportPage?: {
//       url: string,                      // direct link to carrier support
//       instructions: string,             // what to do on the page
//     },
//     claimInfo?: {
//       eligible: boolean,
//       claimUrl: string,                 // direct link to file a claim
//       requiredDocuments: string[],      // e.g. ["Photo of package", "Receipt"]
//       deadlineDays: number,            // days to file claim
//     },
//     taskCreated?: {
//       id: string,
//       title: string,
//       followUpDate: string,
//     },
//   }
//
// APPROACH:
//   1. Receive tracking exception details from client or MCP tool call
//
//   2. Diagnose the exception using carrier-specific logic:
//
//      DELAYED:
//      - Check how many days past expected delivery
//      - < 1 day: LOW severity, suggest waiting
//      - 1-3 days: MEDIUM, suggest contacting carrier
//      - > 3 days: HIGH, recommend filing inquiry
//
//      ATTEMPTED_DELIVERY:
//      - Suggest scheduling redelivery or redirect to hold location
//      - Provide carrier-specific redelivery options:
//        UPS: UPS My Choice redelivery
//        FedEx: FedEx Delivery Manager
//        DHL: On Demand Delivery
//
//      DELIVERED_NOT_RECEIVED:
//      - HIGH severity always
//      - Suggest checking with neighbors, building management
//      - If > 24h: recommend filing a claim
//      - Provide carrier claim URLs and required documentation
//
//      CUSTOMS_HOLD:
//      - Provide customs clearance guidance
//      - DHL-specific: link to MyDHL+ customs tools
//      - Suggest contacting customs broker if applicable
//
//      DAMAGE:
//      - HIGH severity
//      - Instruct user to photograph damage immediately
//      - Provide claim filing URL and deadline
//      - Draft claim email with shipment details
//
//      LOST:
//      - CRITICAL severity
//      - File tracer/investigation request
//      - Provide claim filing URL
//      - Draft comprehensive support email
//
//   3. Generate carrier-specific support content:
//
//      UPS Support:
//      - Support page: https://www.ups.com/us/en/support/contact-us.page
//      - Claims: https://www.ups.com/us/en/support/file-a-claim.page
//      - Phone: 1-800-742-5877
//      - Email format: Include tracking #, service type, dates, description
//      - Claim deadline: 60 days from delivery date
//
//      FedEx Support:
//      - Support page: https://www.fedex.com/en-us/customer-support.html
//      - Claims: https://www.fedex.com/en-us/customer-support/claims.html
//      - Phone: 1-800-463-3339
//      - Email format: Include tracking #, reference #, dates, photos
//      - Claim deadline: 60 days (domestic), 21 days (international)
//
//      DHL Support:
//      - Support page: https://www.dhl.com/us-en/home/our-divisions/express/customer-service.html
//      - Claims: https://www.dhl.com/us-en/home/our-divisions/express/claims.html
//      - Phone: 1-800-225-5345
//      - Email format: Include waybill #, account #, dates, description
//      - Claim deadline: 30 days
//
//      Lugless / LuggageToShip:
//      - Direct support email from their website
//      - Full-service providers: they handle escalation on user's behalf
//      - Draft email requesting status update + resolution
//
//   4. Optionally use LLM (ai-shipping-advisor) to:
//      - Generate a personalized, professional support email draft
//      - Provide context-aware recommendations based on exception details
//      - Translate support guidance for international shipments
//
//   5. Create follow-up task/reminder:
//      - Store escalation in database with status tracking
//      - Set follow-up reminder (e.g. "Check if UPS responded in 2 days")
//      - Link to create-shipment-reminders for calendar integration
//
// INTEGRATION POINTS:
//   - ai-tracking-advisor (existing): When tracking status shows an
//     exception, this function provides the escalation workflow
//   - SavedPage: Add "Report Issue" button for tracked shipments
//     with exception status
//   - Notifications: ai-notification-generator can alert user about
//     exceptions and offer to start escalation
//   - AI agent: Agent can monitor tracking status and proactively
//     ask "Your FedEx package is 2 days late — want me to help
//     you contact support?"
//   - Email connector: Use Resend or email MCP connector to send
//     the drafted support email on user's behalf (with confirmation)
//
// MCP CONNECTORS POTENTIALLY USED:
//   - Resend connector (connector_id: "resend"): To send support emails
//     on the user's behalf after confirmation
//   - Calendar connector: To create follow-up reminders via
//     create-shipment-reminders
//   - Email connector (Gmail/Outlook): To check for carrier responses
//     to support requests
//
// SECRETS REQUIRED:
//   - None for basic diagnosis + support page links
//   - RESEND_API_KEY (optional): For sending support emails
//   - Carrier API keys (optional): For programmatic claim filing
//
// ERROR HANDLING:
//   - Unknown carrier: provide generic support guidance
//   - Invalid tracking number: suggest user verify and re-enter
//   - Support page URL changed: fall back to carrier homepage + search
//   - Email sending fails: provide draft for user to copy-paste manually
//
// EXAMPLE:
//   Input: {
//     userId: "abc-123",
//     trackingNumber: "1Z999AA10123456784",
//     carrier: "UPS",
//     exceptionType: "DELIVERED_NOT_RECEIVED",
//     shipmentContext: {
//       origin: "New York, NY",
//       destination: "Los Angeles, CA",
//       serviceName: "UPS® Ground",
//       dropOffDate: "2026-03-28",
//       expectedDeliveryDate: "2026-04-04",
//       actualStatus: "Delivered - Left at front door"
//     },
//     userNotes: "I was home all day and nothing was delivered",
//     actions: ["DRAFT_EMAIL", "OPEN_SUPPORT_PAGE", "FILE_CLAIM"]
//   }
//   Output: {
//     diagnosis: {
//       severity: "HIGH",
//       explanation: "Package marked as delivered but not received. This is
//         a serious issue that should be reported within 24 hours.",
//       recommendedActions: [
//         "Check with neighbors and building management",
//         "Check for a delivery photo in UPS My Choice",
//         "File a claim with UPS within 60 days",
//         "Contact UPS support with your tracking number"
//       ],
//       estimatedResolutionTime: "3-5 business days for investigation"
//     },
//     supportDraft: {
//       subject: "Missing Package - Tracking 1Z999AA10123456784",
//       body: "Dear UPS Support,\n\nI am writing regarding tracking number
//         1Z999AA10123456784...[full drafted email]",
//       recipientEmail: "customerservice@ups.com",
//       referenceNumber: "1Z999AA10123456784"
//     },
//     supportPage: {
//       url: "https://www.ups.com/us/en/support/file-a-claim.page",
//       instructions: "Click 'Start a Claim', select 'I never received my
//         package', and enter tracking number 1Z999AA10123456784"
//     },
//     claimInfo: {
//       eligible: true,
//       claimUrl: "https://www.ups.com/us/en/support/file-a-claim.page",
//       requiredDocuments: ["Proof of value (receipt)", "Photo ID"],
//       deadlineDays: 60
//     }
//   }
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, trackingNumber, carrier, exceptionType, shipmentContext, userNotes, actions } = await req.json();

    if (!userId || !trackingNumber || !carrier || !exceptionType || !shipmentContext) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, trackingNumber, carrier, exceptionType, shipmentContext" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement exception diagnosis logic per carrier and exception type
    // TODO: Implement severity scoring (days late, exception category, carrier SLA)
    // TODO: Implement carrier-specific support page URL mapping
    // TODO: Implement support email draft generation (carrier-specific templates)
    // TODO: Implement LLM-powered personalized support draft via ai-shipping-advisor
    // TODO: Implement claim eligibility check and claim URL routing
    // TODO: Implement follow-up task creation and reminder scheduling
    // TODO: Implement Resend connector integration for sending support emails
    // TODO: Store escalation history in database for tracking resolution
    // TODO: Register as MCP tool "escalate_tracking_issue"

    return new Response(
      JSON.stringify({
        error: "Tracking issue escalation not yet implemented",
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
