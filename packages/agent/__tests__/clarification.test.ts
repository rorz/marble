import { describe, expect, test } from "bun:test";
import { resolveMarbleAgentClarification } from "../src/clarification";

describe("resolveMarbleAgentClarification", () => {
  test("asks what email enrichment means before creating workflow resources", () => {
    const clarification = resolveMarbleAgentClarification({
      message: 'Make me a project that will "enrich emails".',
    });

    expect(clarification?.reason).toContain("missing the enrichment target");
    expect(clarification?.response).toContain(
      'What should "enrich emails" mean',
    );
  });

  test("asks for an email-finding provider instead of allowing fake inference", () => {
    const clarification = resolveMarbleAgentClarification({
      message:
        "Can we make a project for conference attendees with name and company and get their emails?",
    });

    expect(clarification?.reason).toContain("missing the provider");
    expect(clarification?.response).toContain("Which email-finding provider");
  });

  test("lets specified email workflows proceed", () => {
    const clarification = resolveMarbleAgentClarification({
      message:
        "Set up an Apollo enrichment workflow to find email addresses from name and company.",
    });

    expect(clarification).toBeNull();
  });

  test("lets answers to a prior clarification proceed", () => {
    const clarification = resolveMarbleAgentClarification({
      history: [
        {
          content:
            'Yep. What should "enrich emails" mean here: verify deliverability, find person/company/profile data, draft copy, update CRM fields, or something else?',
          role: "assistant",
        },
      ],
      message: "Use Apollo to find person profile data.",
    });

    expect(clarification).toBeNull();
  });
});
