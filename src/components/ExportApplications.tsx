import { useState } from "react";
import * as XLSX from "xlsx";
import {
    Download,
    FileSpreadsheet,
    FileText,
    X,
} from "lucide-react";

import type {
    Application,
    ApplicationSection,
} from "../types/application";

import {
    buildApplicationsCsv,
    createApplicationsWorkbook,
} from "../utils/applicationExport";

import "./ExportApplications.css";

type ExportScope = "current" | "all";

type ExportApplicationsProps = {
    applications: Application[];
    initialSection: ApplicationSection;
    onCancel: () => void;
};

const SECTION_LABELS: Record<ApplicationSection, string> = {
    "college-placement": "College Placements",
    "off-campus": "Off Campus",
};

const XLSX_MIME_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function dateStamp(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

function ExportApplications({
    applications,
    initialSection,
    onCancel,
}: ExportApplicationsProps) {
    const [scope, setScope] = useState<ExportScope>("current");
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const currentSectionApplications = applications.filter(
        (application) => application.section === initialSection,
    );

    const selectedApplications =
        scope === "current"
            ? currentSectionApplications
            : applications;

    const selectedCount = selectedApplications.length;

    const filenameBase = [
        "career-circus",
        scope === "all"
            ? "all-applications"
            : initialSection,
        dateStamp(),
    ].join("-");

    function getApplicationsBySection(): Partial<
        Record<ApplicationSection, Application[]>
    > {
        if (scope === "current") {
            return {
                [initialSection]: currentSectionApplications,
            };
        }

        return {
            "college-placement": applications.filter(
                (application) =>
                    application.section === "college-placement",
            ),
            "off-campus": applications.filter(
                (application) =>
                    application.section === "off-campus",
            ),
        };
    }

    function handleCsvExport() {
        setError(null);
        setFeedback(null);

        try {
            const csv = buildApplicationsCsv(selectedApplications);

            const blob = new Blob([csv], {
                type: "text/csv;charset=utf-8;",
            });

            downloadBlob(blob, `${filenameBase}.csv`);

            setFeedback(
                `CSV export prepared with ${selectedCount} application${selectedCount === 1 ? "" : "s"}.`,
            );
        } catch {
            setError(
                "The CSV file could not be created. Please try again.",
            );
        }
    }

    function handleExcelExport() {
        setError(null);
        setFeedback(null);

        try {
            const workbook = createApplicationsWorkbook(
                getApplicationsBySection(),
            );

            const fileData = XLSX.write(workbook, {
                bookType: "xlsx",
                type: "array",
            });

            const blob = new Blob([fileData], {
                type: XLSX_MIME_TYPE,
            });

            downloadBlob(blob, `${filenameBase}.xlsx`);

            setFeedback(
                `Excel export prepared with ${selectedCount} application${selectedCount === 1 ? "" : "s"}.`,
            );
        } catch {
            setError(
                "The Excel file could not be created. Please try again.",
            );
        }
    }

    return (
        <section className="export-wizard">
            <header className="export-wizard__header">
                <div className="export-wizard__heading-icon">
                    <Download size={22} />
                </div>

                <div>
                    <p className="export-eyebrow">
                        APPLICATION EXPORT
                    </p>

                    <h2>Export applications</h2>

                    <p className="export-description">
                        Download a copy of your application records.
                    </p>
                </div>

                <button
                    type="button"
                    className="export-close"
                    onClick={onCancel}
                    aria-label="Close export"
                >
                    <X size={19} />
                </button>
            </header>

            <label className="export-field">
                <span>Applications to export</span>

                <select
                    value={scope}
                    onChange={(event) => {
                        setScope(event.target.value as ExportScope);
                        setFeedback(null);
                        setError(null);
                    }}
                >
                    <option value="current">
                        {SECTION_LABELS[initialSection]} (
                        {currentSectionApplications.length})
                    </option>

                    <option value="all">
                        All applications ({applications.length})
                    </option>
                </select>
            </label>

            <div className="export-selection-summary">
                <strong>{selectedCount}</strong>

                <div>
                    <span>
                        application{selectedCount === 1 ? "" : "s"} selected
                    </span>

                    <p>
                        Search, filters, and sorting on the dashboard do not
                        affect the exported records.
                    </p>
                </div>
            </div>

            {scope === "all" && (
                <div className="export-notice">
                    <FileSpreadsheet size={17} />

                    <p>
                        Excel exports keep College Placements and Off Campus
                        on separate worksheets. CSV exports include a Section
                        column so you can distinguish the two.
                    </p>
                </div>
            )}

            <div className="export-notice">
                <FileText size={17} />

                <p>
                    Compensation values retain their stored amounts:
                    stipends are monthly and CTC values are full annual
                    amounts. NA, TBD, and ranges are preserved.
                </p>
            </div>

            <div className="export-format-heading">
                <h3>Choose a format</h3>
                <p>Both formats contain the same application details.</p>
            </div>

            <div className="export-format-grid">
                <button
                    type="button"
                    className="export-format-button"
                    onClick={handleCsvExport}
                    disabled={selectedCount === 0}
                >
                    <span className="export-format-icon">
                        <FileText size={20} />
                    </span>

                    <span className="export-format-copy">
                        <strong>Export CSV</strong>
                        <small>
                            A simple file that opens in spreadsheet apps.
                        </small>
                    </span>

                    <Download size={17} />
                </button>

                <button
                    type="button"
                    className="export-format-button"
                    onClick={handleExcelExport}
                    disabled={selectedCount === 0}
                >
                    <span className="export-format-icon">
                        <FileSpreadsheet size={20} />
                    </span>

                    <span className="export-format-copy">
                        <strong>Export Excel</strong>
                        <small>
                            An XLSX workbook with separate section sheets.
                        </small>
                    </span>

                    <Download size={17} />
                </button>
            </div>

            {selectedCount === 0 && (
                <p className="export-empty-message">
                    There are no applications in this selection to export.
                </p>
            )}

            {feedback && (
                <p className="export-feedback" role="status">
                    {feedback}
                </p>
            )}

            {error && (
                <p className="export-error" role="alert">
                    {error}
                </p>
            )}

            <footer className="export-wizard__footer">
                <button
                    type="button"
                    className="export-cancel-button"
                    onClick={onCancel}
                >
                    Close
                </button>
            </footer>
        </section>
    );
}

export default ExportApplications;