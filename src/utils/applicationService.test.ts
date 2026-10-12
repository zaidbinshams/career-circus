
import { describe, expect, it } from "vitest";
import type { ApplicationDraft } from "../types/application";
import { createValidatedApplication } from "./applicationService";

function collegeInternshipDraft(): ApplicationDraft {
    return {
        section: "college-placement",
        companyName: "Acme Labs",
        role: "Software Intern",
        roleType: "internship",
        currency: "INR",
        stipend: { kind: "fixed", amount: 25000 },
        ctc: null,
        status: "applied",
        reachedStage: "screening",
    };
}

function offCampusFullTimeDraft(): ApplicationDraft {
    return {
        section: "off-campus",
        companyName: "Example Technologies",
        role: "Software Engineer",
        roleType: "full-time",
        currency: "USD",
        stipend: null,
        ctc: { kind: "fixed", amount: 80000 },
        status: "applied",
        reachedStage: "oa",
    };
}

describe("createValidatedApplication", () => {
    it("creates a valid college internship", () => {
        const result = createValidatedApplication(
            collegeInternshipDraft(),
        );

        expect(result.success).toBe(true);

        if (!result.success) return;

        expect(result.application.companyName).toBe("Acme Labs");
        expect(result.application.roleType).toBe("internship");
        expect(result.application.currency).toBe("INR");
        expect(result.application.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
        expect(result.application.ctc).toBeNull();
        expect(result.application.id).toBeTruthy();
        expect(
            Number.isNaN(Date.parse(result.application.createdAt)),
        ).toBe(false);
    });

    it("trims whitespace from company and role names", () => {
        const draft = {
            ...collegeInternshipDraft(),
            companyName: "  Acme Labs  ",
            role: "  Software Intern  ",
        };

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(true);

        if (!result.success) return;

        expect(result.application.companyName).toBe("Acme Labs");
        expect(result.application.role).toBe("Software Intern");
    });

    it("preserves the currency and full annual CTC amount", () => {
        const result = createValidatedApplication(
            offCampusFullTimeDraft(),
        );

        expect(result.success).toBe(true);

        if (!result.success) return;

        expect(result.application.currency).toBe("USD");

        if (result.application.roleType !== "full-time") {
            throw new Error("Expected a full-time application");
        }

        expect(result.application.ctc).toEqual({
            kind: "fixed",
            amount: 80000,
        });
        expect(result.application.stipend).toBeNull();
    });

    it("rejects a compensation range with the minimum above the maximum", () => {
        const draft = {
            ...collegeInternshipDraft(),
            stipend: {
                kind: "range" as const,
                min: 30000,
                max: 20000,
            },
        } as ApplicationDraft;

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.errors).toContain(
            "Stipend minimum cannot exceed its maximum.",
        );
    });

    it("rejects CTC for an internship", () => {
        const draft = {
            ...collegeInternshipDraft(),
            ctc: { kind: "fixed", amount: 800000 },
        } as ApplicationDraft;

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.errors).toContain(
            "CTC must be NA for the selected role type.",
        );
    });

    it("rejects an unsupported currency code", () => {
        const draft = {
            ...collegeInternshipDraft(),
            currency: "XYZ",
        } as unknown as ApplicationDraft;

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.errors).toContain(
            "A valid currency is required.",
        );
    });

    it("rejects a college-only status in an off-campus application", () => {
        const draft = {
            ...offCampusFullTimeDraft(),
            status: "not-eligible",
        } as unknown as ApplicationDraft;

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.errors).toContain(
            "Status contains an invalid or missing selection.",
        );
    });

    it("rejects malformed company names without throwing", () => {
        const draft = {
            ...collegeInternshipDraft(),
            companyName: 123,
        } as unknown as ApplicationDraft;

        expect(() => createValidatedApplication(draft)).not.toThrow();

        const result = createValidatedApplication(draft);

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.errors).toContain("Company name is required.");
    });
});
