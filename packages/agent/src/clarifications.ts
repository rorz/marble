type ChatHistoryEntry = {
  content: string;
  role: "assistant" | "user";
};

type ClarificationInput = {
  history?: ChatHistoryEntry[];
  message: string;
};

type Clarification = {
  reason: string;
  response: string;
};

const AMBIGUOUS_ENRICH_EMAIL_RESPONSE =
  'Yep. What should "enrich emails" mean here: verify deliverability, find person/company/profile data, draft copy, update CRM fields, or something else? Also, which provider/source should power it?';

const MISSING_EMAIL_PROVIDER_RESPONSE =
  "Yep. Which email-finding provider or source should I use for that: Apollo, Hunter, Clearbit, an existing Marble program, or something else?";

const WORKFLOW_PATTERN =
  /\b(project|workflow|flow|pipeline|automation|webhook|integration|setup|set up|build|make|create)\b/i;
const ENRICH_PATTERN = /\benrich(?:ment|es|ed|ing)?\b/i;
const EMAIL_PATTERN = /\be-?mails?\b|\bemail addresses?\b/i;
const EMAIL_FINDING_PATTERN =
  /\b(find|get|fetch|look\s*up|discover|append|add)\b[\s\S]{0,80}\be-?mails?\b|\be-?mails?\b[\s\S]{0,80}\b(find|get|lookup|discover|append)\b/i;
const ENRICHMENT_TARGET_PATTERN =
  /\b(verify|deliverability|valid(?:ate|ation)?|bounce|person|people|contact|profile|company|domain|title|role|seniority|linkedin|crm|salesforce|hubspot|reply|copy|draft|personalize|phone|location)\b/i;
const PROVIDER_PATTERN =
  /\b(apollo|hunter|clearbit|people data labs|pdl|rocketreach|dropcontact|snov|zerobounce|neverbounce|kickbox|fullcontact|existing program|custom api|api key|provider|source)\b/i;
const DUMMY_PATTERN = /\b(dummy|demo|fake|sample|placeholder|test data)\b/i;

const hasPattern = (pattern: RegExp, text: string): boolean =>
  pattern.test(text);

const recentAssistantAskedEmailClarification = (
  history: ChatHistoryEntry[] | undefined,
): boolean =>
  (history ?? []).slice(-4).some((entry) => {
    if (entry.role !== "assistant") return false;
    return (
      entry.content.includes('"enrich emails"') ||
      entry.content.includes("Which email-finding provider")
    );
  });

export const resolveMarbleAgentClarification = (
  input: ClarificationInput,
): Clarification | null => {
  const message = input.message.trim();
  if (!message) return null;

  const workflowIntent = hasPattern(WORKFLOW_PATTERN, message);
  const emailMentioned = hasPattern(EMAIL_PATTERN, message);
  const enrichmentMentioned = hasPattern(ENRICH_PATTERN, message);
  const emailFindingMentioned = hasPattern(EMAIL_FINDING_PATTERN, message);
  const hasTarget = hasPattern(ENRICHMENT_TARGET_PATTERN, message);
  const hasProvider = hasPattern(PROVIDER_PATTERN, message);
  const acceptsDummyWork = hasPattern(DUMMY_PATTERN, message);
  const answeringPriorQuestion = recentAssistantAskedEmailClarification(
    input.history,
  );

  if (answeringPriorQuestion || acceptsDummyWork || !workflowIntent) {
    return null;
  }

  if (emailMentioned && enrichmentMentioned && !hasTarget) {
    return {
      reason: "Email enrichment request is missing the enrichment target.",
      response: AMBIGUOUS_ENRICH_EMAIL_RESPONSE,
    };
  }

  if (emailFindingMentioned && !hasProvider) {
    return {
      reason: "Email-finding workflow is missing the provider/source.",
      response: MISSING_EMAIL_PROVIDER_RESPONSE,
    };
  }

  return null;
};
