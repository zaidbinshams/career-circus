import { describe, expect, it } from "vitest";
import type { ApplicationSection } from "../types/application";
import {
    EMPTY_COLUMN_MAPPING,
    parseImportRow,
    suggestColumnMapping,
    type ColumnMapping,
    type CtcUnitChoice,
    type RoleTypeChoice,
} from "./spreadsheetImport";

function mapping(
    overrides: Partial<ColumnMapping> = {},
): ColumnMapping {
    return {
        ...EMPTY_COLUMN_MAPPING,
        companyName: 0,
        role: 1,
        stipend: 2,
        ctc: 3,
        status: 4,
        reachedStage: 5,
        currency: 6,
        ...overrides,
    };
}

function parse(
    cells: unknown[],
    columnMapping: ColumnMapping = mapping(),
    section: ApplicationSection = "college-placement",
    ctcUnit: CtcUnitChoice = "unconfirmed",
    roleType: RoleTypeChoice = "unconfirmed",
    headers: string[] = [],
    defaultCurrency: "INR" | "USD" | "EUR" | "GBP" | "CAD" = "INR",
) {
    return parseImportRow(
        2,
        cells,
        columnMapping,
        section,
        defaultCurrency,
        ctcUnit,
        roleType,
        headers,
    );
}

describe("spreadsheet import", () => {
    it("suggests common column mappings", () => {
        const result = suggestColumnMapping([
            "Company Name",
            "Job Title",
            "Monthly Stipend",
            "Annual CTC",
            "Status",
            "Reached Stage",
        ]);

        expect(result).toEqual({
            ...EMPTY_COLUMN_MAPPING,
            companyName: 0,
            role: 1,
            stipend: 2,
            ctc: 3,
            status: 4,
            reachedStage: 5,
        });
    });

    it("automatically converts CTC from LPA when the header says LPA", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "Applied", "OA", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [
                "Company",
                "Role",
                "Stipend",
                "CTC (LPA)",
                "Status",
                "Stage",
                "Currency",
            ],
        );

        expect(result.needsCtcUnitConfirmation).toBe(false);
        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
        expect(result.draft?.roleType).toBe("full-time");
    });

    it("recognizes a header that says the CTC is in lakhs", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 12, "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            ["Company", "Role", "Stipend", "Salary (in lakhs)", "Status", "Stage", "Currency"],
        );

        expect(result.needsCtcUnitConfirmation).toBe(false);
        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 1200000,
        });
    });

    it("converts stipend values from thousands per month when the header says KPM", () => {
        const result = parse(
            ["Beta", "Intern", 25, "NA", "Applied", "Interview", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            ["Company", "Role", "Stipend (KPM)", "CTC", "Status", "Stage", "Currency"],
        );

        expect(result.draft?.roleType).toBe("internship");
        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
        expect(result.draft?.ctc).toBeNull();
    });

    it("recognizes explicit LPA in an individual cell", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "8 LPA",
            "Applied",
            "OA",
            "INR",
        ]);

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("still asks for confirmation when a small CTC has no stated unit", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            8,
            "Applied",
            "OA",
            "INR",
        ]);

        expect(result.needsCtcUnitConfirmation).toBe(true);
        expect(result.draft).toBeNull();
    });

    it("converts an ambiguous CTC to LPA when the user selects that unit", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "Applied", "OA", "INR"],
            mapping(),
            "college-placement",
            "lpa",
        );

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("keeps an ambiguous CTC as the full annual amount when selected", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "Applied", "OA", "INR"],
            mapping(),
            "college-placement",
            "annual",
        );

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 8,
        });
    });

    it("detects INR from a currency symbol in the amount", () => {
        const result = parse(
            ["Beta", "Intern", "₹25,000", "NA", "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "USD",
        );

        expect(result.draft?.currency).toBe("INR");
        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
    });

    it("detects currency from a compensation header", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            ["Company", "Role", "Stipend", "CTC (USD LPA)", "Status", "Stage", "Currency"],
            "INR",
        );

        expect(result.draft?.currency).toBe("USD");
        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("lets an explicitly mapped currency override detected currencies", () => {
        const customMapping = mapping({ currency: 7 });

        const result = parse(
            ["Beta", "Intern", "₹25,000", "NA", "", "", "", "CAD"],
            customMapping,
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "USD",
        );

        expect(result.draft?.currency).toBe("CAD");
    });

    it("uses the selected fallback when no currency can be detected", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 800000, "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "USD",
        );

        expect(result.draft?.currency).toBe("USD");
    });

    it("uses TBD for a blank or unmapped role", () => {
        const blankRole = parse([
            "Acme",
            "",
            "NA",
            "8 LPA",
            "",
            "",
            "INR",
        ]);

        expect(blankRole.draft?.role).toBe("TBD");

        const unmappedRole = parse(
            ["Acme", "", "NA", "8 LPA", "", "", "INR"],
            mapping({ role: null }),
        );

        expect(unmappedRole.draft?.role).toBe("TBD");
    });

    it("infers internship when the CTC is NA", () => {
        const result = parse([
            "Beta",
            "Intern",
            25000,
            "NA",
            "Applied",
            "Interview",
            "INR",
        ]);

        expect(result.draft?.roleType).toBe("internship");
        expect(result.draft?.ctc).toBeNull();
    });

    it("infers full-time when the stipend is NA", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "8 LPA",
            "Applied",
            "OA",
            "INR",
        ]);

        expect(result.draft?.roleType).toBe("full-time");
        expect(result.draft?.stipend).toBeNull();
    });

    it("infers internship plus full-time when both compensations apply", () => {
        const result = parse([
            "Gamma",
            "Associate",
            30000,
            "8 LPA",
            "Applied",
            "Screening",
            "INR",
        ]);

        expect(result.draft?.roleType).toBe("internship-plus-full-time");
        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 30000,
        });
        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("requires a manual role-type selection when both compensations are NA", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "NA",
            "",
            "",
            "INR",
        ]);

        expect(result.needsRoleTypeConfirmation).toBe(true);
        expect(result.draft).toBeNull();
    });

    it("requires a company name mapping", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", "8 LPA", "", "", "INR"],
            mapping({ companyName: null }),
        );

        expect(result.errors).toContain(
            "Map a column to Company name before importing.",
        );
        expect(result.draft).toBeNull();
    });

    it("rejects a compensation range whose minimum exceeds its maximum", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "12-8 LPA",
            "",
            "",
            "INR",
        ]);

        expect(result.errors).toContain(
            "CTC range minimum cannot exceed its maximum.",
        );
        expect(result.draft).toBeNull();
    });
});