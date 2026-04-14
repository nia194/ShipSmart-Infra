// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOL: CALENDAR / REMINDER CREATION FOR SHIPMENT MILESTONES
// ─────────────────────────────────────────────────────────────────────────────
//
// USE CASE:
//   Users care about key shipping dates but have no automated way to
//   remember them. This tool creates calendar events and reminders for:
//   - Drop-off deadline (the date they need to hand off the package)
//   - Expected delivery date (when the recipient should expect it)
//   - Booking cutoff (carrier-specific cutoff times, e.g. "By 5:30 PM")
//   - Tracking check-in (a reminder to verify delivery status)
//   This extends the app into the user's daily workflow instead of leaving
//   them to manually remember deadlines.
//
// WHY MCP:
//   Expose as an MCP tool so the AI agent can:
//   - Proactively suggest: "Want me to add a drop-off reminder to your calendar?"
//   - Create reminders after user saves or books a service
//   - Customize reminder timing based on context (morning before drop-off, etc.)
//   The agent decides when and what reminders are helpful; the tool handles
//   calendar API integration.
//
// TOOL SIGNATURE:
//   Name: create_shipment_reminders
//   Input: {
//     userId: string,
//     calendarProvider: "google" | "outlook" | "apple",
//     shipmentContext: {
//       carrier: string,              // "UPS", "FedEx", etc.
//       serviceName: string,          // "UPS® Ground"
//       origin: string,
//       destination: string,
//       dropOffDate: string,          // ISO date
//       expectedDeliveryDate: string, // ISO date
//       cutoffTime?: string,          // e.g. "5:30 PM"
//       trackingNumber?: string,
//       bookingUrl?: string,          // carrier booking URL
//       savedOptionId?: string,       // link to saved_options row
//     },
//     reminders: Array<{
//       type: "DROP_OFF" | "DELIVERY_EXPECTED" | "BOOKING_CUTOFF" | "TRACKING_CHECK",
//       reminderBefore?: string,      // e.g. "1h", "1d", "30m" — time before event
//     }>,
//   }
//   Output: {
//     created: Array<{
//       type: string,
//       calendarEventId: string,
//       title: string,
//       dateTime: string,
//       calendarUrl: string,          // deep link to open event in calendar app
//     }>,
//     provider: string,
//   }
//
// APPROACH:
//   1. Authenticate with user's calendar via MCP calendar connector
//
//      Google Calendar:
//      - API: Google Calendar API v3
//      - Endpoint: https://www.googleapis.com/calendar/v3/calendars/primary/events
//      - Auth: OAuth2 (scope: calendar.events)
//      - MCP connector: standard_connectors--connect (connector_id: "google_calendar")
//      - Create events with reminders (popup + email notifications)
//      - Include structured description with carrier, route, tracking info
//
//      Microsoft Outlook Calendar:
//      - API: Microsoft Graph Calendar API
//      - Endpoint: https://graph.microsoft.com/v1.0/me/events
//      - Auth: OAuth2 (scope: Calendars.ReadWrite)
//      - MCP connector: standard_connectors--connect (connector_id: "microsoft")
//      - Create events with reminder minutes before
//
//      Apple Calendar (via CalDAV):
//      - Generate .ics file and provide download link
//      - Or use Apple's CalDAV protocol if connector available
//      - Fallback: generate .ics files that user can import manually
//
//   2. Generate event details per reminder type:
//
//      DROP_OFF reminder:
//      - Title: "📦 Drop off {carrier} shipment"
//      - Description: "Drop off your {serviceName} package at [nearest location].
//        Route: {origin} → {destination}. Cutoff: {cutoffTime}."
//      - Time: dropOffDate, default reminder 1 day before + morning of
//      - Attach booking URL and nearest drop-off location info
//
//      DELIVERY_EXPECTED reminder:
//      - Title: "📬 {carrier} delivery expected"
//      - Description: "Your {serviceName} shipment should arrive today.
//        Tracking: {trackingNumber}. Route: {origin} → {destination}."
//      - Time: expectedDeliveryDate
//      - Include tracking link in description
//
//      BOOKING_CUTOFF reminder:
//      - Title: "⏰ {carrier} booking cutoff at {cutoffTime}"
//      - Description: "Last chance to drop off for {serviceName}.
//        Cutoff: {cutoffTime}."
//      - Time: dropOffDate at cutoffTime, reminder 2 hours before
//
//      TRACKING_CHECK reminder:
//      - Title: "🔍 Check {carrier} delivery status"
//      - Description: "Your shipment was expected to arrive. Check
//        tracking status and confirm delivery."
//      - Time: 1 day after expectedDeliveryDate
//
//   3. Store created calendar event IDs in database for future management
//      (update if dates change, delete if shipment is cancelled)
//
// INTEGRATION POINTS:
//   - QuoteRow "Book" button flow: After user clicks Book, offer to create
//     drop-off and delivery reminders automatically
//   - SavedPage (src/pages/SavedPage.tsx): Add "Add to Calendar" button
//     for each saved option, creating all relevant reminders
//   - Post-booking: After tracking number is imported, add delivery
//     expected and tracking check reminders
//   - AI agent: Agent can suggest "Want me to add these dates to your
//     calendar?" after user saves a service or completes booking
//   - Notification system: Complement calendar reminders with in-app
//     notifications via ai-notification-generator
//
// MCP CONNECTORS NEEDED:
//   - Google Calendar connector: For Google Workspace / personal Gmail users
//     - Scopes: calendar.events (read/write calendar events)
//     - Connect via: standard_connectors--connect (connector_id: "google_calendar")
//   - Microsoft Graph connector: For Outlook / Microsoft 365 users
//     - Scopes: Calendars.ReadWrite
//     - Connect via: standard_connectors--connect (connector_id: "microsoft")
//
// FALLBACK (no calendar connector):
//   - Generate downloadable .ics file (iCalendar format) with all events
//   - User can import into any calendar app (Apple, Google, Outlook, etc.)
//   - Provide "Add to Google Calendar" URL (no API needed):
//     https://calendar.google.com/calendar/r/eventedit?text=...&dates=...
//
// ERROR HANDLING:
//   - Calendar connector not linked: offer .ics download fallback
//   - Event creation fails: retry once, then fall back to .ics
//   - Duplicate events: check for existing events with same title + date
//     before creating (idempotency)
//   - Permission denied: prompt user to reconnect with correct scopes
//
// EXAMPLE:
//   Input: {
//     userId: "abc-123",
//     calendarProvider: "google",
//     shipmentContext: {
//       carrier: "FedEx",
//       serviceName: "FedEx Express Saver®",
//       origin: "New York, NY",
//       destination: "Los Angeles, CA",
//       dropOffDate: "2026-04-06",
//       expectedDeliveryDate: "2026-04-09",
//       cutoffTime: "5:30 PM",
//       trackingNumber: "794644790138"
//     },
//     reminders: [
//       { type: "DROP_OFF", reminderBefore: "1d" },
//       { type: "DELIVERY_EXPECTED" },
//       { type: "TRACKING_CHECK" }
//     ]
//   }
//   Output: {
//     created: [
//       {
//         type: "DROP_OFF",
//         calendarEventId: "gcal-evt-abc",
//         title: "📦 Drop off FedEx shipment",
//         dateTime: "2026-04-06T09:00:00-04:00",
//         calendarUrl: "https://calendar.google.com/calendar/event?eid=gcal-evt-abc"
//       },
//       {
//         type: "DELIVERY_EXPECTED",
//         calendarEventId: "gcal-evt-def",
//         title: "📬 FedEx delivery expected",
//         dateTime: "2026-04-09T09:00:00-07:00",
//         calendarUrl: "https://calendar.google.com/calendar/event?eid=gcal-evt-def"
//       },
//       {
//         type: "TRACKING_CHECK",
//         calendarEventId: "gcal-evt-ghi",
//         title: "🔍 Check FedEx delivery status",
//         dateTime: "2026-04-10T10:00:00-07:00",
//         calendarUrl: "https://calendar.google.com/calendar/event?eid=gcal-evt-ghi"
//       }
//     ],
//     provider: "google"
//   }
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, calendarProvider, shipmentContext, reminders } = await req.json();

    if (!userId || !calendarProvider || !shipmentContext || !reminders?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, calendarProvider, shipmentContext, reminders" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement Google Calendar API integration (calendar.events scope)
    // TODO: Implement Microsoft Graph Calendar API integration (Calendars.ReadWrite)
    // TODO: Implement .ics file generation fallback
    // TODO: Implement "Add to Google Calendar" URL generation (no-auth fallback)
    // TODO: Generate event titles and descriptions per reminder type
    // TODO: Store calendar event IDs for future management (update/delete)
    // TODO: Implement duplicate event detection (idempotency)
    // TODO: Register as MCP tool "create_shipment_reminders"

    return new Response(
      JSON.stringify({
        error: "Calendar reminder creation not yet implemented",
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
