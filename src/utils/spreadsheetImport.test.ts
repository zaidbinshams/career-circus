import { describe, expect, it } from "vitest";

import type {
    ApplicationSection,
    CurrencyCode,
} from "../types/application";

import {
    EMPTY_COLUMN_MAPPING,
    parseImportRow,
    suggestColumnMapping,
    type ColumnMapping,
    type CtcUnitChoice,
    type CurrencyMode,
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
    defaultCurrency: CurrencyCode = "INR",
    currencyMode: CurrencyMode = "auto",
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
        currencyMode,
    );
}

describe("spreadsheet import: column mapping", () => {
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

    it("automatically maps headers with unit suffixes", () => {
        const result = suggestColumnMapping([
            "Company Name",
            "Job Title",
            "Monthly Stipend (KPM)",
            "CTC (LPA)",
            "Application Status",
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

    it("automatically maps headers with currency and unit information", () => {
        const result = suggestColumnMapping([
            "Employer",
            "Position",
            "Stipend (INR, KPM)",
            "Annual Salary (USD, LPA)",
            "Status",
            "Stage",
            "Currency",
        ]);

        expect(result.companyName).toBe(0);
        expect(result.role).toBe(1);
        expect(result.stipend).toBe(2);
        expect(result.ctc).toBe(3);
        expect(result.status).toBe(4);
        expect(result.reachedStage).toBe(5);
        expect(result.currency).toBe(6);
    });

    it("does not map one source column to multiple fields", () => {
        const result = suggestColumnMapping([
            "Company Name",
            "Stipend (KPM)",
            "CTC (LPA)",
        ]);

        const mappedColumns = Object.values(result).filter(
            (value) => value !== null,
        );

        expect(new Set(mappedColumns).size).toBe(
            mappedColumns.length,
        );
    });
});

describe("spreadsheet import: compensation units", () => {
    it("converts CTC from LPA when the header says LPA", () => {
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

        expect(
            result.warnings.some((warning) =>
                warning.includes("multiplied by 100,000"),
            ),
        ).toBe(true);
    });

    it("recognizes LPA in different header formats", () => {
        const headerExamples = [
            "Salary (in lakhs)",
            "CTC [LPA]",
            "Annual Package - Lacs",
        ];

        for (const header of headerExamples) {
            const result = parse(
                ["Acme", "Engineer", "NA", 12, "", "", ""],
                mapping(),
                "college-placement",
                "unconfirmed",
                "unconfirmed",
                [
                    "Company",
                    "Role",
                    "Stipend",
                    header,
                    "Status",
                    "Stage",
                    "Currency",
                ],
            );

            expect(result.needsCtcUnitConfirmation).toBe(false);

            expect(result.draft?.ctc).toEqual({
                kind: "fixed",
                amount: 1200000,
            });
        }
    });

    it("converts stipend values from thousands per month when the header says KPM", () => {
        const result = parse(
            ["Beta", "Intern", 25, "NA", "Applied", "Interview", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [
                "Company",
                "Role",
                "Stipend (KPM)",
                "CTC",
                "Status",
                "Stage",
                "Currency",
            ],
        );

        expect(result.draft?.roleType).toBe("internship");

        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });

        expect(result.draft?.ctc).toBeNull();

        expect(
            result.warnings.some((warning) =>
                warning.includes("multiplied by 1,000"),
            ),
        ).toBe(true);
    });

    it("recognizes other thousands-per-month header formats", () => {
        const headerExamples = [
            "Stipend (thousands per month)",
            "Stipend (in thousands)",
            "Monthly Stipend (000s/month)",
        ];

        for (const header of headerExamples) {
            const result = parse(
                ["Beta", "Intern", 25, "NA", "", "", ""],
                mapping(),
                "college-placement",
                "unconfirmed",
                "unconfirmed",
                [
                    "Company",
                    "Role",
                    header,
                    "CTC",
                    "Status",
                    "Stage",
                    "Currency",
                ],
            );

            expect(result.draft?.stipend).toEqual({
                kind: "fixed",
                amount: 25000,
            });
        }
    });

    it("recognizes LPA explicitly written in a cell", () => {
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

    it("recognizes thousands explicitly written in a stipend cell", () => {
        const result = parse([
            "Beta",
            "Intern",
            "25k",
            "NA",
            "Applied",
            "Interview",
            "INR",
        ]);

        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
    });

    it("does not ask for CTC unit confirmation when the header specifies LPA", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "", "", ""],
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
    });

    it("asks for confirmation when a small CTC has no stated unit", () => {
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

    it("also asks for confirmation for a small CTC range", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "8-10",
            "Applied",
            "OA",
            "INR",
        ]);

        expect(result.needsCtcUnitConfirmation).toBe(true);
        expect(result.draft).toBeNull();
    });

    it("converts an ambiguous CTC to LPA when selected", () => {
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

    it("keeps an ambiguous CTC as a full annual amount when selected", () => {
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

    it("converts an ambiguous CTC range to LPA when selected", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", "8-10", "", "", "INR"],
            mapping(),
            "college-placement",
            "lpa",
        );

        expect(result.draft?.ctc).toEqual({
            kind: "range",
            min: 800000,
            max: 1000000,
        });
    });

    it("rejects conflicting unit signals between the header and cell", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", "8 annual", "", "", ""],
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

        expect(result.errors.length).toBeGreaterThan(0);
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

describe("spreadsheet import: currency detection", () => {
    it("detects INR from a rupee symbol in the compensation value", () => {
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
        expect(result.currency).toBe("INR");

        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
    });

    it("detects USD from a compensation header", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [
                "Company",
                "Role",
                "Stipend",
                "CTC (USD LPA)",
                "Status",
                "Stage",
                "Currency",
            ],
            "INR",
        );

        expect(result.draft?.currency).toBe("USD");

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("supports country-specific dollar symbols", () => {
        const examples = [
            ["US$25,000", "USD"],
            ["CA$25,000", "CAD"],
            ["A$25,000", "AUD"],
            ["S$25,000", "SGD"],
        ] as const;

        for (const [value, expectedCurrency] of examples) {
            const result = parse(
                ["Beta", "Intern", value, "NA", "", "", ""],
                mapping(),
                "college-placement",
                "unconfirmed",
                "unconfirmed",
                [],
                "INR",
            );

            expect(result.draft?.currency).toBe(expectedCurrency);
        }
    });

    it("uses the mapped currency column before automatic detection", () => {
        const customMapping = mapping({
            currency: 7,
        });

        const result = parse(
            [
                "Beta",
                "Intern",
                "₹25,000",
                "NA",
                "",
                "",
                "",
                "CAD",
            ],
            customMapping,
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "USD",
        );

        expect(result.draft?.currency).toBe("CAD");
    });

    it("uses the fallback when no currency can be detected", () => {
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

    it("does not silently interpret a generic dollar symbol as USD", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", "$50,000", "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "INR",
        );

        // The generic dollar symbol is not enough to identify a currency.
        expect(result.draft?.currency).toBe("INR");

        // Check that the parser flags the uncertainty without tying this
        // test to the exact wording of the warning.
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("uses the fallback and warns when compensation values conflict", () => {
        const result = parse(
            [
                "Acme",
                "Associate",
                "₹25,000",
                "USD 8 LPA",
                "",
                "",
                "",
            ],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "EUR",
        );

        expect(result.draft?.currency).toBe("EUR");

        expect(
            result.warnings.some((warning) =>
                warning.includes("Conflicting currencies"),
            ),
        ).toBe(true);
    });

    it("forces the selected currency for every row in fixed mode", () => {
        const customMapping = mapping({
            currency: 7,
        });

        const result = parse(
            [
                "Beta",
                "Intern",
                "₹25,000",
                "NA",
                "",
                "",
                "",
                "CAD",
            ],
            customMapping,
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "GBP",
            "fixed",
        );

        expect(result.draft?.currency).toBe("GBP");
        expect(result.currency).toBe("GBP");
    });

    it("retains the resolved currency even when a row needs review", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", 8, "", "", ""],
            mapping(),
            "college-placement",
            "unconfirmed",
            "unconfirmed",
            [],
            "INR",
            "auto",
        );

        expect(result.needsCtcUnitConfirmation).toBe(true);
        expect(result.draft).toBeNull();
        expect(result.currency).toBe("INR");
    });
});

describe("spreadsheet import: role type and optional fields", () => {
    it("infers full-time when stipend is NA and CTC is present", () => {
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

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("infers internship when CTC is NA and stipend is present", () => {
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

        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 25000,
        });
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

        expect(result.draft?.roleType).toBe(
            "internship-plus-full-time",
        );

        expect(result.draft?.stipend).toEqual({
            kind: "fixed",
            amount: 30000,
        });

        expect(result.draft?.ctc).toEqual({
            kind: "fixed",
            amount: 800000,
        });
    });

    it("requires manual role-type selection when both compensations are NA", () => {
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

    it("uses TBD for a blank role", () => {
        const result = parse([
            "Acme",
            "",
            "NA",
            "8 LPA",
            "",
            "",
            "INR",
        ]);

        expect(result.draft?.role).toBe("TBD");
    });

    it("uses TBD when the role column is unmapped", () => {
        const result = parse(
            ["Acme", "", "NA", "8 LPA", "", "", "INR"],
            mapping({
                role: null,
            }),
        );

        expect(result.draft?.role).toBe("TBD");
    });

    it("requires company name mapping", () => {
        const result = parse(
            ["Acme", "Engineer", "NA", "8 LPA", "", "", "INR"],
            mapping({
                companyName: null,
            }),
        );

        expect(result.errors).toContain(
            "Map a column to Company name before importing.",
        );

        expect(result.draft).toBeNull();
    });

    it("rejects a row with a blank company name", () => {
        const result = parse([
            "",
            "Engineer",
            "NA",
            "8 LPA",
            "",
            "",
            "INR",
        ]);

        expect(result.errors).toContain(
            "Company name is missing.",
        );

        expect(result.draft).toBeNull();
    });

    it("allows blank status and stage", () => {
        const result = parse([
            "Acme",
            "Engineer",
            "NA",
            "8 LPA",
            "",
            "",
            "INR",
        ]);

        expect(result.errors).toEqual([]);
        expect(result.draft?.status).toBeNull();
        expect(result.draft?.reachedStage).toBeNull();
    });

    it("rejects a status that is invalid for Off Campus", () => {
        const result = parse(
            [
                "Acme",
                "Engineer",
                "NA",
                "8 LPA",
                "Not Eligible",
                "OA",
                "INR",
            ],
            mapping(),
            "off-campus",
        );

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.draft).toBeNull();
    });
});