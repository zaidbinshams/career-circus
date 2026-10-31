import * as XLSX from "xlsx";

import type {
    Application,
    ApplicationSection,
    Compensation,
} from "../types/application";

export const APPLICATION_EXPORT_HEADERS = [
    "Company Name",
    "Role",
    "Role Type",
    "Section",
    "Monthly Stipend",
    "Annual CTC",
    "Currency",
    "Application Status",
    "Reached Stage",
    "Date Added",
] as const;

export type ExportCell = string | number;

const SECTION_LABELS: Record<ApplicationSection, string> = {
    "college-placement": "College Placements",
    "off-campus": "Off Campus",
};

function formatLabel(value: string | null): string {
    if (value === null) return "";

    const labels: Record<string, string> = {
        oa: "OA",
        ppt: "PPT",
        "not-eligible": "Not eligible",
        "not-applied": "Not applied",
        "not-placed": "Not placed",
        "full-time": "Full-time",
        "internship-plus-full-time": "Internship + full-time",
        nothing: "Nothing",
    };

    if (labels[value]) return labels[value];

    return value
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function compensationForExport(
    compensation: Compensation | null,
): ExportCell {
    if (compensation === null) return "NA";

    if (compensation.kind === "tbd") {
        return "TBD";
    }

    if (compensation.kind === "fixed") {
        return compensation.amount;
    }

    return `${compensation.min} - ${compensation.max}`;
}

export function applicationToExportRow(
    application: Application,
): ExportCell[] {
    return [
        application.companyName,
        application.role,
        formatLabel(application.roleType),
        SECTION_LABELS[application.section],
        compensationForExport(application.stipend),
        compensationForExport(application.ctc),
        application.currency,
        formatLabel(application.status),
        formatLabel(application.reachedStage),
        application.createdAt,
    ];
}

export function buildApplicationExportRows(
    applications: Application[],
): ExportCell[][] {
    return [
        [...APPLICATION_EXPORT_HEADERS],
        ...applications.map(applicationToExportRow),
    ];
}

function escapeCsvCell(value: ExportCell): string {
    let text = String(value);

    // Protect text cells from spreadsheet formula injection.
    if (
        typeof value === "string" &&
        /^[\u0000-\u0020]*[=+\-@]/.test(text)
    ) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

export function buildApplicationsCsv(
    applications: Application[],
): string {
    const rows = buildApplicationExportRows(applications);

    const csv = rows
        .map((row) => row.map(escapeCsvCell).join(","))
        .join("\r\n");

    // The BOM helps spreadsheet applications recognize UTF-8.
    return `\uFEFF${csv}`;
}

export function createApplicationsWorkbook(
    applicationsBySection: Partial<
        Record<ApplicationSection, Application[]>
    >,
): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    const sectionOrder: ApplicationSection[] = [
        "college-placement",
        "off-campus",
    ];

    for (const section of sectionOrder) {
        const applications = applicationsBySection[section];

        if (applications === undefined) {
            continue;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(
            buildApplicationExportRows(applications),
        );

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            SECTION_LABELS[section],
        );
    }

    return workbook;
}