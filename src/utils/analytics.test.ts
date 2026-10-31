import { describe, expect, it } from "vitest";

import type { Application } from "../types/application";

import {
    buildAnalyticsSummary,
    buildCompensationCoverage,
    buildMonthlyActivity,
    buildRoleTypeDistribution,
    buildSectionDistribution,
    buildStageDistribution,
    buildStatusDistribution,
    filterApplicationsByScope,
} from "./analytics";

const applications: Application[] = [
    {
        id: "1",
        companyName: "Acme",
        role: "Intern",
        section: "college-placement",
        roleType: "internship",
        currency: "INR",
        stipend: { kind: "fixed", amount: 25000 },
        ctc: null,
        status: "applied",
        reachedStage: "interview",
        createdAt: "2026-10-10T10:00:00.000Z",
    },
    {
        id: "2",
        companyName: "Beta",
        role: "Engineer",
        section: "college-placement",
        roleType: "full-time",
        currency: "INR",
        stipend: null,
        ctc: { kind: "range", min: 700000, max: 900000 },
        status: "placed",
        reachedStage: "offer",
        createdAt: "2026-09-15T10:00:00.000Z",
    },
    {
        id: "3",
        companyName: "Gamma",
        role: "Developer",
        section: "off-campus",
        roleType: "internship-plus-full-time",
        currency: "USD",
        stipend: { kind: "tbd" },
        ctc: { kind: "fixed", amount: 80000 },
        status: null,
        reachedStage: null,
        createdAt: "2026-10-20T10:00:00.000Z",
    },
];

describe("analytics scope", () => {
    it("returns all applications for the all scope", () => {
        expect(
            filterApplicationsByScope(applications, "all"),
        ).toHaveLength(3);
    });

    it("filters applications by section", () => {
        expect(
            filterApplicationsByScope(
                applications,
                "college-placement",
            ),
        ).toHaveLength(2);

        expect(
            filterApplicationsByScope(
                applications,
                "off-campus",
            ),
        ).toHaveLength(1);
    });
});

describe("analytics summary", () => {
    it("calculates application metrics without double-counting offers", () => {
        expect(buildAnalyticsSummary(applications)).toEqual({
            total: 3,
            applied: 1,
            interviewStage: 1,
            offersOrPlaced: 1,
        });
    });

    it("handles an empty application list", () => {
        expect(buildAnalyticsSummary([])).toEqual({
            total: 0,
            applied: 0,
            interviewStage: 0,
            offersOrPlaced: 0,
        });
    });
});

describe("analytics distributions", () => {
    it("counts application statuses, including unset values", () => {
        const result = buildStatusDistribution(applications);

        expect(
            result.find((item) => item.key === "applied")?.count,
        ).toBe(1);

        expect(
            result.find((item) => item.key === "placed")?.count,
        ).toBe(1);

        expect(
            result.find((item) => item.key === "not-set")?.count,
        ).toBe(1);
    });

    it("counts recruitment stages, including unset values", () => {
        const result = buildStageDistribution(applications);

        expect(
            result.find((item) => item.key === "interview")?.count,
        ).toBe(1);

        expect(
            result.find((item) => item.key === "offer")?.count,
        ).toBe(1);

        expect(
            result.find((item) => item.key === "not-set")?.count,
        ).toBe(1);
    });

    it("calculates role type percentages", () => {
        const result = buildRoleTypeDistribution(applications);

        expect(
            result.find((item) => item.key === "internship")
                ?.percentage,
        ).toBeCloseTo(100 / 3);

        expect(
            result.reduce((total, item) => total + item.count, 0),
        ).toBe(3);
    });

    it("counts applications by section", () => {
        const result = buildSectionDistribution(applications);

        expect(
            result.find((item) => item.key === "college-placement")
                ?.count,
        ).toBe(2);

        expect(
            result.find((item) => item.key === "off-campus")
                ?.count,
        ).toBe(1);
    });
});

describe("monthly application activity", () => {
    it("returns the requested number of months in chronological order", () => {
        const result = buildMonthlyActivity(
            applications,
            new Date("2026-10-31T12:00:00.000Z"),
            3,
        );

        expect(result.map((item) => item.key)).toEqual([
            "2026-08",
            "2026-09",
            "2026-10",
        ]);

        expect(result.map((item) => item.count)).toEqual([
            0,
            1,
            2,
        ]);
    });

    it("does not count applications outside the selected month window", () => {
        const result = buildMonthlyActivity(
            applications,
            new Date("2026-10-31T12:00:00.000Z"),
            1,
        );

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe("2026-10");
        expect(result[0].count).toBe(2);
    });

    it("falls back to six months for an invalid month count", () => {
        const result = buildMonthlyActivity(
            applications,
            new Date("2026-10-31T12:00:00.000Z"),
            0,
        );

        expect(result).toHaveLength(6);
    });
});

describe("compensation coverage", () => {
    it("keeps compensation counts separated by currency", () => {
        const result = buildCompensationCoverage(applications);

        const inr = result.find((item) => item.currency === "INR");
        const usd = result.find((item) => item.currency === "USD");

        expect(inr).toEqual({
            currency: "INR",
            stipend: {
                fixed: 1,
                range: 0,
                tbd: 0,
                na: 1,
            },
            ctc: {
                fixed: 0,
                range: 1,
                tbd: 0,
                na: 1,
            },
        });

        expect(usd).toEqual({
            currency: "USD",
            stipend: {
                fixed: 0,
                range: 0,
                tbd: 1,
                na: 0,
            },
            ctc: {
                fixed: 1,
                range: 0,
                tbd: 0,
                na: 0,
            },
        });
    });

    it("returns no rows when there are no applications", () => {
        expect(buildCompensationCoverage([])).toEqual([]);
    });
});