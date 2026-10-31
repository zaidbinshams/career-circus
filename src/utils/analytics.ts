import type {
    Application,
    ApplicationSection,
    CurrencyCode,
} from "../types/application";

export type AnalyticsScope = "all" | ApplicationSection;

export type DistributionItem = {
    key: string;
    label: string;
    count: number;
    percentage: number;
};

export type MonthlyActivityItem = {
    key: string;
    label: string;
    count: number;
};

export type CompensationCoverage = {
    fixed: number;
    range: number;
    tbd: number;
    na: number;
};

export type CompensationCoverageRow = {
    currency: CurrencyCode;
    stipend: CompensationCoverage;
    ctc: CompensationCoverage;
};

export type AnalyticsSummary = {
    total: number;
    applied: number;
    interviewStage: number;
    offersOrPlaced: number;
};

const STATUS_OPTIONS = [
    { key: "applied", label: "Applied" },
    { key: "not-applied", label: "Not applied" },
    { key: "placed", label: "Placed" },
    { key: "not-placed", label: "Not placed" },
    { key: "not-eligible", label: "Not eligible" },
    { key: "not-set", label: "Not set" },
] as const;

const STAGE_OPTIONS = [
    { key: "nothing", label: "Nothing" },
    { key: "screening", label: "Screening" },
    { key: "ppt", label: "PPT" },
    { key: "oa", label: "OA" },
    { key: "interview", label: "Interview" },
    { key: "offer", label: "Offer" },
    { key: "not-set", label: "Not set" },
] as const;

const ROLE_OPTIONS = [
    { key: "internship", label: "Internship" },
    { key: "full-time", label: "Full-time" },
    {
        key: "internship-plus-full-time",
        label: "Internship + full-time",
    },
] as const;

const SECTION_OPTIONS = [
    {
        key: "college-placement",
        label: "College Placements",
    },
    {
        key: "off-campus",
        label: "Off Campus",
    },
] as const;

function createDistribution(
    applications: Application[],
    options: readonly {
        key: string;
        label: string;
    }[],
    getKey: (application: Application) => string,
): DistributionItem[] {
    const counts = new Map<string, number>();

    for (const option of options) {
        counts.set(option.key, 0);
    }

    for (const application of applications) {
        const key = getKey(application);

        if (counts.has(key)) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }

    return options.map((option) => {
        const count = counts.get(option.key) ?? 0;

        return {
            key: option.key,
            label: option.label,
            count,
            percentage:
                applications.length === 0
                    ? 0
                    : (count / applications.length) * 100,
        };
    });
}

export function filterApplicationsByScope(
    applications: Application[],
    scope: AnalyticsScope,
): Application[] {
    if (scope === "all") {
        return applications;
    }

    return applications.filter(
        (application) => application.section === scope,
    );
}

export function buildAnalyticsSummary(
    applications: Application[],
): AnalyticsSummary {
    return {
        total: applications.length,

        applied: applications.filter(
            (application) => application.status === "applied",
        ).length,

        interviewStage: applications.filter(
            (application) => application.reachedStage === "interview",
        ).length,

        offersOrPlaced: applications.filter(
            (application) =>
                application.status === "placed" ||
                application.reachedStage === "offer",
        ).length,
    };
}

export function buildStatusDistribution(
    applications: Application[],
): DistributionItem[] {
    return createDistribution(
        applications,
        STATUS_OPTIONS,
        (application) => application.status ?? "not-set",
    );
}

export function buildStageDistribution(
    applications: Application[],
): DistributionItem[] {
    return createDistribution(
        applications,
        STAGE_OPTIONS,
        (application) => application.reachedStage ?? "not-set",
    );
}

export function buildRoleTypeDistribution(
    applications: Application[],
): DistributionItem[] {
    return createDistribution(
        applications,
        ROLE_OPTIONS,
        (application) => application.roleType,
    );
}

export function buildSectionDistribution(
    applications: Application[],
): DistributionItem[] {
    return createDistribution(
        applications,
        SECTION_OPTIONS,
        (application) => application.section,
    );
}

export function buildMonthlyActivity(
    applications: Application[],
    referenceDate: Date = new Date(),
    monthCount = 6,
): MonthlyActivityItem[] {
    const safeMonthCount =
        Number.isInteger(monthCount) && monthCount > 0
            ? Math.min(monthCount, 24)
            : 6;

    const currentMonth = new Date(
        Date.UTC(
            referenceDate.getUTCFullYear(),
            referenceDate.getUTCMonth(),
            1,
        ),
    );

    const months = Array.from(
        { length: safeMonthCount },
        (_, index) => {
            const date = new Date(
                Date.UTC(
                    currentMonth.getUTCFullYear(),
                    currentMonth.getUTCMonth() -
                    (safeMonthCount - 1 - index),
                    1,
                ),
            );

            const key = [
                date.getUTCFullYear(),
                String(date.getUTCMonth() + 1).padStart(2, "0"),
            ].join("-");

            const label = new Intl.DateTimeFormat("en-IN", {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
            }).format(date);

            return {
                key,
                label,
                count: 0,
            };
        },
    );

    const counts = new Map(
        months.map((month) => [month.key, month] as const),
    );

    for (const application of applications) {
        const timestamp = Date.parse(application.createdAt);

        if (!Number.isFinite(timestamp)) {
            continue;
        }

        const date = new Date(timestamp);

        const key = [
            date.getUTCFullYear(),
            String(date.getUTCMonth() + 1).padStart(2, "0"),
        ].join("-");

        const month = counts.get(key);

        if (month) {
            month.count += 1;
        }
    }

    return months;
}

function emptyCoverage(): CompensationCoverage {
    return {
        fixed: 0,
        range: 0,
        tbd: 0,
        na: 0,
    };
}

function addCompensationCount(
    coverage: CompensationCoverage,
    compensation: Application["stipend"],
): void {
    if (compensation === null) {
        coverage.na += 1;
        return;
    }

    if (compensation.kind === "tbd") {
        coverage.tbd += 1;
        return;
    }

    if (compensation.kind === "fixed") {
        coverage.fixed += 1;
        return;
    }

    coverage.range += 1;
}

export function buildCompensationCoverage(
    applications: Application[],
): CompensationCoverageRow[] {
    const rows = new Map<CurrencyCode, CompensationCoverageRow>();

    for (const application of applications) {
        let row = rows.get(application.currency);

        if (!row) {
            row = {
                currency: application.currency,
                stipend: emptyCoverage(),
                ctc: emptyCoverage(),
            };

            rows.set(application.currency, row);
        }

        addCompensationCount(row.stipend, application.stipend);
        addCompensationCount(row.ctc, application.ctc);
    }

    return [...rows.values()].sort(
        (a, b) => a.currency.localeCompare(b.currency),
    );
}