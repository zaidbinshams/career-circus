import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import type { Application } from "../types/application";

import {
    APPLICATION_EXPORT_HEADERS,
    buildApplicationExportRows,
    buildApplicationsCsv,
    createApplicationsWorkbook,
} from "./applicationExport";

const collegeInternship: Application = {
    id: "application-1",
    companyName: "Acme, Research",
    role: "Software Intern",
    section: "college-placement",
    roleType: "internship",
    stipend: {
        kind: "range",
        min: 20000,
        max: 30000,
    },
    ctc: null,
    currency: "INR",
    status: "applied",
    reachedStage: "oa",
    createdAt: "2026-10-30T10:00:00.000Z",
};

const offCampusFullTime: Application = {
    id: "application-2",
    companyName: "Example Technologies",
    role: "Software Engineer",
    section: "off-campus",
    roleType: "full-time",
    stipend: null,
    ctc: {
        kind: "fixed",
        amount: 800000,
    },
    currency: "USD",
    status: null,
    reachedStage: "interview",
    createdAt: "2026-10-29T10:00:00.000Z",
};

describe("application export rows", () => {
    it("exports all application fields in a consistent order", () => {
        const rows = buildApplicationExportRows([
            collegeInternship,
            offCampusFullTime,
        ]);

        expect(rows[0]).toEqual(APPLICATION_EXPORT_HEADERS);

        expect(rows[1]).toEqual([
            "Acme, Research",
            "Software Intern",
            "Internship",
            "College Placements",
            "20000 - 30000",
            "NA",
            "INR",
            "Applied",
            "OA",
            "2026-10-30T10:00:00.000Z",
        ]);

        expect(rows[2]).toEqual([
            "Example Technologies",
            "Software Engineer",
            "Full-time",
            "Off Campus",
            "NA",
            800000,
            "USD",
            "",
            "Interview",
            "2026-10-29T10:00:00.000Z",
        ]);
    });

    it("preserves TBD compensation", () => {
        const application: Application = {
            ...collegeInternship,
            stipend: { kind: "tbd" },
        };

        const rows = buildApplicationExportRows([application]);

        expect(rows[1][4]).toBe("TBD");
    });
});

describe("application CSV export", () => {
    it("includes a UTF-8 BOM and quotes CSV cells", () => {
        const csv = buildApplicationsCsv([collegeInternship]);

        expect(csv.charCodeAt(0)).toBe(0xfeff);
        expect(csv).toContain('"Company Name"');
        expect(csv).toContain('"Acme, Research"');
    });

    it("escapes quotes inside cell values", () => {
        const application: Application = {
            ...collegeInternship,
            companyName: 'Acme, "Research"',
        };

        const csv = buildApplicationsCsv([application]);

        expect(csv).toContain('"Acme, ""Research"""');
    });

    it("protects text cells from spreadsheet formula injection", () => {
        const application: Application = {
            ...collegeInternship,
            companyName: "=SUM(1,1)",
        };

        const csv = buildApplicationsCsv([application]);

        expect(csv).toContain('"\'=SUM(1,1)"');
    });
});

describe("application Excel export", () => {
    it("creates separate worksheets for both application sections", () => {
        const workbook = createApplicationsWorkbook({
            "college-placement": [collegeInternship],
            "off-campus": [offCampusFullTime],
        });

        expect(workbook.SheetNames).toEqual([
            "College Placements",
            "Off Campus",
        ]);
    });

    it("creates a workbook containing only the requested section", () => {
        const workbook = createApplicationsWorkbook({
            "college-placement": [collegeInternship],
        });

        expect(workbook.SheetNames).toEqual([
            "College Placements",
        ]);
    });

    it("writes export data into the worksheet", () => {
        const workbook = createApplicationsWorkbook({
            "college-placement": [collegeInternship],
        });

        const worksheet = workbook.Sheets["College Placements"];

        const rows = XLSX.utils.sheet_to_json<unknown[]>(
            worksheet,
            { header: 1 },
        );

        expect(rows[0]).toEqual(APPLICATION_EXPORT_HEADERS);
        expect(rows[1][0]).toBe("Acme, Research");
        expect(rows[1][4]).toBe("20000 - 30000");
    });
});