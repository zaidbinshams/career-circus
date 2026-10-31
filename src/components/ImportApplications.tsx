import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import {
    AlertTriangle,
    CheckCircle2,
    FileSpreadsheet,
    RotateCcw,
    Upload,
    X,
} from "lucide-react";
import {
    CURRENCY_CODES,
    type ApplicationDraft,
    type ApplicationSection,
    type CurrencyCode,
} from "../types/application";
import { formatCompensation } from "../utils/compensation";
import {
    IMPORT_FIELD_INFO,
    parseImportRow,
    suggestColumnMapping,
    EMPTY_COLUMN_MAPPING,
    type ColumnMapping,
    type CtcUnitChoice,
    type ImportField,
    type ParsedImportRow,
    type RoleTypeChoice,
} from "../utils/spreadsheetImport";
import "./ImportApplications.css";

export type ImportCommitResult = {
    importedCount: number;
    errors: string[];
};

type ImportApplicationsProps = {
    initialSection: ApplicationSection;
    availableSections: ApplicationSection[];
    onImport: (drafts: ApplicationDraft[]) => ImportCommitResult;
    onCancel: () => void;
    onAddSkippedManually: (section: ApplicationSection) => void;
};

type SourceRow = {
    sourceRow: number;
    cells: unknown[];
};

type PreviewRow = SourceRow & ParsedImportRow;

type SkippedRow = {
    sourceRow: number;
    reasons: string[];
};

type ImportSummary = {
    importedCount: number;
    skippedRows: SkippedRow[];
    omittedFields: ImportField[];
    warnings: string[];
    errors: string[];
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

const FIELD_LABELS = Object.fromEntries(
    IMPORT_FIELD_INFO.map((item) => [item.field, item.label]),
) as Record<ImportField, string>;

function readSheetRows(
    workbook: XLSX.WorkBook,
    sheetName: string,
): unknown[][] {
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) return [];

    return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        raw: false,
        defval: null,
        blankrows: true,
    });
}

function textOf(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value).trim();
}

function hasCellContent(cells: unknown[]): boolean {
    return cells.some((cell) => textOf(cell) !== "");
}

function displayMappedCell(
    cells: unknown[],
    mapping: ColumnMapping,
    field: ImportField,
): string {
    const columnIndex = mapping[field];

    if (columnIndex === null) return "—";

    return textOf(cells[columnIndex]) || "—";
}

function canImportRow(row: PreviewRow): boolean {
    return (
        row.draft !== null &&
        row.errors.length === 0 &&
        !row.needsCtcUnitConfirmation &&
        !row.needsRoleTypeConfirmation
    );
}

function getSkippedReason(row: PreviewRow): string[] {
    if (row.errors.length > 0) return row.errors;

    const reasons: string[] = [];

    if (row.needsRoleTypeConfirmation) {
        reasons.push(
            "Role type could not be inferred from stipend and CTC; choose it in the preview.",
        );
    }

    if (row.needsCtcUnitConfirmation) {
        reasons.push(
            `CTC "${row.ambiguousCtcValue ?? ""}" needs a unit choice.`,
        );
    }

    if (reasons.length > 0) return reasons;

    if (!row.draft) {
        return ["Required fields are missing or invalid."];
    }

    return ["Not selected for import."];
}

function SheetRowPreview({
    row,
    mapping,
    selected,
    ctcUnitChoice,
    roleTypeChoice,
    onSelect,
    onCtcUnitChange,
    onRoleTypeChange,
}: {
    row: PreviewRow;
    mapping: ColumnMapping;
    selected: boolean;
    ctcUnitChoice: CtcUnitChoice;
    roleTypeChoice: RoleTypeChoice;
    onSelect: (checked: boolean) => void;
    onCtcUnitChange: (choice: CtcUnitChoice) => void;
    onRoleTypeChange: (choice: RoleTypeChoice) => void;
}) {
    const canImport = canImportRow(row);

    const rawRole =
        mapping.role === null ? "" : textOf(row.cells[mapping.role]);

    return (
        <tr>
            <td>
                <input
                    type="checkbox"
                    aria-label={`Select spreadsheet row ${row.sourceRow}`}
                    checked={selected}
                    disabled={!canImport}
                    onChange={(event) => onSelect(event.target.checked)}
                />
            </td>

            <td>{row.sourceRow}</td>

            <td>
                {row.draft?.companyName ??
                    displayMappedCell(row.cells, mapping, "companyName")}
            </td>

            <td>
                {row.roleType ? (
                    row.roleType.replaceAll("-", " ")
                ) : (
                    <label className="ctc-unit-review">
                        <span className="sr-only">
                            Role type for row {row.sourceRow}
                        </span>
                        <select
                            value={roleTypeChoice}
                            onChange={(event) =>
                                onRoleTypeChange(
                                    event.target.value as RoleTypeChoice,
                                )
                            }
                        >
                            <option value="unconfirmed">
                                Choose role type…
                            </option>
                            <option value="internship">Internship</option>
                            <option value="full-time">Full-time</option>
                            <option value="internship-plus-full-time">
                                Internship + full-time
                            </option>
                        </select>
                    </label>
                )}
            </td>

            <td>{row.draft?.role ?? (rawRole || "TBD")}</td>

            <td>
                {row.draft
                    ? formatCompensation(
                        row.draft.stipend,
                        "stipend",
                        row.draft.currency,
                    )
                    : displayMappedCell(row.cells, mapping, "stipend")}
            </td>

            <td>
                {row.needsCtcUnitConfirmation ? (
                    <div className="ctc-unit-review">
                        <strong>{row.ambiguousCtcValue}</strong>
                        <label>
                            <span className="sr-only">
                                CTC unit for row {row.sourceRow}
                            </span>
                            <select
                                value={ctcUnitChoice}
                                onChange={(event) =>
                                    onCtcUnitChange(
                                        event.target.value as CtcUnitChoice,
                                    )
                                }
                            >
                                <option value="unconfirmed">
                                    Confirm unit…
                                </option>
                                <option value="annual">
                                    Full annual amount
                                </option>
                                <option value="lpa">
                                    LPA (multiply by 100,000)
                                </option>
                            </select>
                        </label>
                    </div>
                ) : row.draft ? (
                    formatCompensation(
                        row.draft.ctc,
                        "ctc",
                        row.draft.currency,
                    )
                ) : (
                    displayMappedCell(row.cells, mapping, "ctc")
                )}
            </td>

            <td>
                {row.draft
                    ? row.draft.status ?? "Not set"
                    : displayMappedCell(row.cells, mapping, "status")}
            </td>

            <td>
                {row.draft
                    ? row.draft.reachedStage ?? "Not set"
                    : displayMappedCell(row.cells, mapping, "reachedStage")}
            </td>

            <td>
                {row.errors.length > 0 ? (
                    <div className="import-row-issues import-row-issues--error">
                        <strong>Cannot import</strong>
                        <ul>
                            {row.errors.map((error, index) => (
                                <li key={`${error}-${index}`}>{error}</li>
                            ))}
                        </ul>
                    </div>
                ) : row.needsCtcUnitConfirmation ||
                    row.needsRoleTypeConfirmation ? (
                    <div className="import-row-issues">
                        <strong>Confirmation needed</strong>

                        {row.needsRoleTypeConfirmation && (
                            <p>
                                Choose a role type. It could not be inferred
                                from the mapped compensation columns.
                            </p>
                        )}

                        {row.needsCtcUnitConfirmation && (
                            <p>
                                Choose whether this CTC value is a full annual
                                amount or LPA.
                            </p>
                        )}
                    </div>
                ) : row.warnings.length > 0 ? (
                    <div className="import-row-issues">
                        <strong>Review notes</strong>
                        <ul>
                            {row.warnings.map((warning, index) => (
                                <li key={`${warning}-${index}`}>
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <span className="import-valid-label">
                        <CheckCircle2 size={14} />
                        Ready
                    </span>
                )}
            </td>
        </tr>
    );
}

export default function ImportApplications({
    initialSection,
    availableSections,
    onImport,
    onCancel,
    onAddSkippedManually,
}: ImportApplicationsProps) {
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [fileName, setFileName] = useState("");
    const [sheetName, setSheetName] = useState("");
    const [headerRow, setHeaderRow] = useState(0);

    const [mapping, setMapping] = useState<ColumnMapping>({
        ...EMPTY_COLUMN_MAPPING,
    });

    const [section, setSection] = useState<ApplicationSection>(() =>
        availableSections.includes(initialSection)
            ? initialSection
            : availableSections[0] ?? "college-placement",
    );

    const [defaultCurrency, setDefaultCurrency] =
        useState<CurrencyCode>("INR");

    const [ctcUnitChoices, setCtcUnitChoices] =
        useState<Record<number, CtcUnitChoice>>({});

    const [roleTypeChoices, setRoleTypeChoices] =
        useState<Record<number, RoleTypeChoice>>({});

    const [selectedRows, setSelectedRows] = useState<Set<number>>(
        () => new Set(),
    );

    const [fileError, setFileError] = useState<string | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);

    const matrix = useMemo(
        () =>
            workbook && sheetName
                ? readSheetRows(workbook, sheetName)
                : [],
        [workbook, sheetName],
    );

    const headers = matrix[headerRow] ?? [];

    const headerStrings = useMemo(
        () =>
            headers.map((value, index) => {
                const header = textOf(value);
                return header || `Column ${index + 1}`;
            }),
        [headers],
    );

    const columnCount = matrix
        .slice(headerRow)
        .reduce(
            (maximum, row) => Math.max(maximum, row.length),
            headers.length,
        );

    const columns = Array.from({ length: columnCount }, (_, index) => ({
        index,
        header: headerStrings[index] ?? `Column ${index + 1}`,
    }));

    const sourceRows: SourceRow[] = useMemo(
        () =>
            matrix
                .slice(headerRow + 1)
                .map((cells, index) => ({
                    sourceRow: headerRow + index + 2,
                    cells,
                }))
                .filter((row) => hasCellContent(row.cells)),
        [matrix, headerRow],
    );

    const tooManyRows = sourceRows.length > MAX_IMPORT_ROWS;

    useEffect(() => {
        if (!workbook || !sheetName) return;

        setMapping(suggestColumnMapping(headerStrings));
        setCtcUnitChoices({});
        setRoleTypeChoices({});
        setSelectedRows(new Set());
        setSummary(null);
    }, [workbook, sheetName, headerRow, headerStrings]);

    const previewRows = useMemo<PreviewRow[]>(() => {
        if (tooManyRows) return [];

        return sourceRows.map((row) => ({
            ...row,
            ...parseImportRow(
                row.sourceRow,
                row.cells,
                mapping,
                section,
                defaultCurrency,
                ctcUnitChoices[row.sourceRow] ?? "unconfirmed",
                roleTypeChoices[row.sourceRow] ?? "unconfirmed",
            ),
        }));
    }, [
        sourceRows,
        mapping,
        section,
        defaultCurrency,
        ctcUnitChoices,
        roleTypeChoices,
        tooManyRows,
    ]);

    // Start by selecting all rows that are fully valid and unambiguous.
    useEffect(() => {
        setSelectedRows(
            new Set(
                previewRows
                    .filter(canImportRow)
                    .map((row) => row.sourceRow),
            ),
        );
    }, [previewRows]);

    const missingFields = IMPORT_FIELD_INFO.filter(
        (item) => mapping[item.field] === null,
    );

    const validRows = previewRows.filter(canImportRow);

    const selectedValidRows = validRows.filter((row) =>
        selectedRows.has(row.sourceRow),
    );

    const invalidRowCount = previewRows.filter(
        (row) => !canImportRow(row),
    ).length;

    async function handleFileChange(
        event: ChangeEvent<HTMLInputElement>,
    ) {
        const file = event.target.files?.[0];

        // Reset the input so selecting the same file again triggers change.
        event.target.value = "";

        if (!file) return;

        setFileError(null);
        setSummary(null);
        setWorkbook(null);
        setFileName("");

        if (file.size > MAX_FILE_SIZE) {
            setFileError("The file exceeds the 20 MB import limit.");
            return;
        }

        if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) {
            setFileError("Choose an .xlsx, .xls, .xlsm, or .csv file.");
            return;
        }

        try {
            const buffer = await file.arrayBuffer();

            const parsed = XLSX.read(buffer, {
                type: "array",
                cellDates: true,
            });

            if (parsed.SheetNames.length === 0) {
                setFileError("No worksheets were found in this file.");
                return;
            }

            setWorkbook(parsed);
            setFileName(file.name);
            setSheetName(parsed.SheetNames[0]);
            setHeaderRow(0);

            setSection(
                availableSections.includes(initialSection)
                    ? initialSection
                    : availableSections[0] ?? "college-placement",
            );

            setCtcUnitChoices({});
            setRoleTypeChoices({});
            setSelectedRows(new Set());
            setSummary(null);
        } catch {
            setFileError(
                "The file could not be read. Check that it is a valid spreadsheet and try again.",
            );
        }
    }

    function changeSheet(nextSheet: string) {
        setSheetName(nextSheet);
        setHeaderRow(0);
        setCtcUnitChoices({});
        setRoleTypeChoices({});
        setSelectedRows(new Set());
        setSummary(null);
    }

    function changeHeaderRow(nextRow: number) {
        setHeaderRow(nextRow);
        setCtcUnitChoices({});
        setRoleTypeChoices({});
        setSelectedRows(new Set());
        setSummary(null);
    }

    function changeMapping(
        field: ImportField,
        index: number | null,
    ) {
        setMapping((current) => {
            const next = { ...current };

            // Keep the mapping one-to-one: a source column maps to one field.
            if (index !== null) {
                for (const key of Object.keys(next) as ImportField[]) {
                    if (key !== field && next[key] === index) {
                        next[key] = null;
                    }
                }
            }

            next[field] = index;
            return next;
        });

        setCtcUnitChoices({});
        setRoleTypeChoices({});
        setSummary(null);
    }

    function resetAutoMapping() {
        setMapping(suggestColumnMapping(headerStrings));
        setCtcUnitChoices({});
        setRoleTypeChoices({});
        setSummary(null);
    }

    function setRowSelected(sourceRow: number, checked: boolean) {
        setSelectedRows((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(sourceRow);
            } else {
                next.delete(sourceRow);
            }

            return next;
        });
    }

    function setAllValidRows(checked: boolean) {
        setSelectedRows(
            checked
                ? new Set(validRows.map((row) => row.sourceRow))
                : new Set(),
        );
    }

    function setCtcUnitChoice(
        sourceRow: number,
        choice: CtcUnitChoice,
    ) {
        setCtcUnitChoices((current) => {
            const next = { ...current };

            if (choice === "unconfirmed") {
                delete next[sourceRow];
            } else {
                next[sourceRow] = choice;
            }

            return next;
        });

        setSummary(null);
    }

    function setRoleTypeChoice(
        sourceRow: number,
        choice: RoleTypeChoice,
    ) {
        setRoleTypeChoices((current) => {
            const next = { ...current };

            if (choice === "unconfirmed") {
                delete next[sourceRow];
            } else {
                next[sourceRow] = choice;
            }

            return next;
        });

        setSummary(null);
    }

    function commitImport() {
        const rowsToImport = previewRows.filter(
            (row) =>
                selectedRows.has(row.sourceRow) &&
                canImportRow(row),
        );

        if (rowsToImport.length === 0) return;

        const result = onImport(
            rowsToImport.map((row) => row.draft as ApplicationDraft),
        );

        const importedSourceRows = new Set(
            rowsToImport.map((row) => row.sourceRow),
        );

        const skippedRows: SkippedRow[] = previewRows
            .filter((row) => !importedSourceRows.has(row.sourceRow))
            .map((row) => ({
                sourceRow: row.sourceRow,
                reasons: getSkippedReason(row),
            }));

        setSummary({
            importedCount: result.importedCount,
            skippedRows,
            omittedFields: missingFields.map((item) => item.field),
            warnings: rowsToImport.flatMap((row) =>
                row.warnings.map(
                    (warning) => `Row ${row.sourceRow}: ${warning}`,
                ),
            ),
            errors: result.errors,
        });
    }

    if (summary) {
        return (
            <section className="import-wizard">
                <header className="import-wizard__header">
                    <div className="import-wizard__heading-icon">
                        <CheckCircle2 size={22} />
                    </div>

                    <div>
                        <p className="form-eyebrow">IMPORT REVIEW</p>
                        <h2>Import summary</h2>
                        <p className="form-description">
                            Your selected valid rows have been added to the dashboard.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="form-close"
                        onClick={onCancel}
                        aria-label="Close import"
                    >
                        <X size={19} />
                    </button>
                </header>

                <div className="import-summary-metrics">
                    <div>
                        <span>Imported</span>
                        <strong>{summary.importedCount}</strong>
                    </div>
                    <div>
                        <span>Not imported</span>
                        <strong>{summary.skippedRows.length}</strong>
                    </div>
                </div>

                {summary.errors.length > 0 && (
                    <div className="import-notice import-notice--warning">
                        <AlertTriangle size={17} />
                        <div>
                            <strong>Some records could not be saved</strong>
                            <ul>
                                {summary.errors.map((error, index) => (
                                    <li key={`${error}-${index}`}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {summary.omittedFields.length > 0 && (
                    <div className="import-notice">
                        <AlertTriangle size={17} />
                        <div>
                            <strong>Columns not mapped</strong>
                            <p>
                                {summary.omittedFields
                                    .map((field) => FIELD_LABELS[field])
                                    .join(", ")}
                            </p>
                            <p>
                                Missing optional details can be filled in later by editing
                                the imported application. Rows without a company name, with invalid values,
                                or needing an unresolved role-type or CTC-unit choice are not imported.
                            </p>
                        </div>
                    </div>
                )}

                {summary.warnings.length > 0 && (
                    <details className="import-details">
                        <summary>
                            Review {summary.warnings.length} import note
                            {summary.warnings.length === 1 ? "" : "s"}
                        </summary>
                        <ul>
                            {summary.warnings.map((warning, index) => (
                                <li key={`${warning}-${index}`}>{warning}</li>
                            ))}
                        </ul>
                    </details>
                )}

                {summary.skippedRows.length > 0 && (
                    <div className="import-skipped-list">
                        <h3>Rows to review or add manually</h3>
                        <p>
                            These source rows were excluded from the import. You can add
                            missing applications using the manual entry form.
                        </p>

                        <ul>
                            {summary.skippedRows.slice(0, 30).map((row) => (
                                <li key={row.sourceRow}>
                                    <strong>Row {row.sourceRow}</strong>
                                    <span>{row.reasons.join(" ")}</span>
                                </li>
                            ))}
                        </ul>

                        {summary.skippedRows.length > 30 && (
                            <p>
                                And {summary.skippedRows.length - 30} more rows.
                            </p>
                        )}
                    </div>
                )}

                <footer className="import-wizard__footer">
                    {summary.skippedRows.length > 0 && (
                        <button
                            type="button"
                            className="form-button form-button--secondary"
                            onClick={() => onAddSkippedManually(section)}
                        >
                            Open manual entry
                        </button>
                    )}

                    <button
                        type="button"
                        className="form-button form-button--primary"
                        onClick={onCancel}
                    >
                        Done
                    </button>
                </footer>
            </section>
        );
    }

    return (
        <section className="import-wizard">
            <header className="import-wizard__header">
                <div className="import-wizard__heading-icon">
                    <FileSpreadsheet size={22} />
                </div>

                <div>
                    <p className="form-eyebrow">SPREADSHEET IMPORT</p>
                    <h2>Import applications</h2>
                    <p className="form-description">
                        Map your spreadsheet columns, review the records, and choose
                        exactly which valid rows to import.
                    </p>
                </div>

                <button
                    type="button"
                    className="form-close"
                    onClick={onCancel}
                    aria-label="Close import"
                >
                    <X size={19} />
                </button>
            </header>

            <div className="import-notice">
                <Upload size={17} />
                <div>
                    <strong>Your file stays in this browser</strong>
                    <p>
                        Only mapped fields are used. Other columns are ignored.
                        Review the preview before importing; invalid or ambiguous rows
                        cannot be selected.
                    </p>
                </div>
            </div>

            <label className="import-file-picker">
                <Upload size={22} />
                <strong>{fileName || "Choose a spreadsheet"}</strong>
                <span>Supported: XLSX, XLS, XLSM, CSV · Maximum 20 MB</span>
                <input
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.csv"
                    onChange={handleFileChange}
                />
            </label>

            {fileError && (
                <p className="import-file-error" role="alert">
                    {fileError}
                </p>
            )}

            {workbook && (
                <>
                    <div className="import-settings-grid">
                        <label className="import-control">
                            <span>Worksheet</span>
                            <select
                                value={sheetName}
                                onChange={(event) => changeSheet(event.target.value)}
                            >
                                {workbook.SheetNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="import-control">
                            <span>Header row</span>
                            <select
                                value={headerRow}
                                onChange={(event) =>
                                    changeHeaderRow(Number(event.target.value))
                                }
                            >
                                {matrix.slice(0, 20).map((cells, index) => (
                                    <option key={index} value={index}>
                                        Row {index + 1}:{" "}
                                        {cells
                                            .map(textOf)
                                            .filter(Boolean)
                                            .join(" · ")
                                            .slice(0, 65) || "(blank)"}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="import-control">
                            <span>Import into</span>
                            <select
                                value={section}
                                onChange={(event) => {
                                    setSection(
                                        event.target.value as ApplicationSection,
                                    );
                                    setSummary(null);
                                }}
                            >
                                {availableSections.map((option) => (
                                    <option key={option} value={option}>
                                        {option === "college-placement"
                                            ? "College Placements"
                                            : "Off Campus"}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="import-control">
                            <span>Default currency</span>
                            <select
                                value={defaultCurrency}
                                onChange={(event) =>
                                    setDefaultCurrency(
                                        event.target.value as CurrencyCode,
                                    )
                                }
                            >
                                {CURRENCY_CODES.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="import-section-heading">
                        <div>
                            <h3>Map your columns</h3>
                            <p>
                                Automatic matches are suggestions. Check them and change
                                any mapping that is incorrect.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="import-text-button"
                            onClick={resetAutoMapping}
                        >
                            <RotateCcw size={14} />
                            Auto-detect
                        </button>
                    </div>

                    <div className="import-mapping-grid">
                        {IMPORT_FIELD_INFO.map((item) => (
                            <label className="import-control" key={item.field}>
                                <span>
                                    {item.label}
                                    {item.required && (
                                        <span className="import-required">Required</span>
                                    )}
                                </span>

                                <select
                                    value={
                                        mapping[item.field] === null
                                            ? ""
                                            : String(mapping[item.field])
                                    }
                                    onChange={(event) =>
                                        changeMapping(
                                            item.field,
                                            event.target.value === ""
                                                ? null
                                                : Number(event.target.value),
                                        )
                                    }
                                >
                                    <option value="">Not mapped</option>
                                    {columns.map((column) => {
                                        const usedByOtherField = (
                                            Object.keys(mapping) as ImportField[]
                                        ).some(
                                            (field) =>
                                                field !== item.field &&
                                                mapping[field] === column.index,
                                        );

                                        return (
                                            <option
                                                key={column.index}
                                                value={column.index}
                                                disabled={usedByOtherField}
                                            >
                                                {String.fromCharCode(
                                                    65 + (column.index % 26),
                                                )}
                                                {column.index >= 26
                                                    ? Math.floor(column.index / 26)
                                                    : ""}{" "}
                                                — {column.header}
                                            </option>
                                        );
                                    })}
                                </select>

                                <small>{item.help}</small>
                            </label>
                        ))}
                    </div>

                    {missingFields.length > 0 && (
                        <div className="import-notice import-notice--warning">
                            <AlertTriangle size={17} />
                            <div>
                                <strong>Some website fields are not mapped</strong>
                                <p>
                                    {missingFields
                                        .map((field) => FIELD_LABELS[field.field])
                                        .join(", ")}
                                </p>
                                <p>
                                    Company name is the only required column mapping. A blank or unmapped
                                    role becomes TBD. Role type is inferred from stipend and CTC; rows
                                    without enough compensation information need a role-type choice.
                                    Missing status or stage remains blank. Missing applicable compensation
                                    becomes TBD. If currency is not mapped, the selected default is used.
                                </p>
                            </div>
                        </div>
                    )}

                    {tooManyRows ? (
                        <div className="import-notice import-notice--warning">
                            <AlertTriangle size={17} />
                            <div>
                                <strong>Too many rows for one import</strong>
                                <p>
                                    This worksheet contains more than {MAX_IMPORT_ROWS} data
                                    rows. Split it into smaller files and import them separately.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="import-section-heading import-preview-heading">
                                <div>
                                    <h3>Preview and select rows</h3>
                                    <p>
                                        {selectedValidRows.length} valid row
                                        {selectedValidRows.length === 1 ? "" : "s"} selected ·{" "}
                                        {invalidRowCount} row
                                        {invalidRowCount === 1 ? "" : "s"} need review
                                    </p>
                                </div>

                                <div className="import-selection-buttons">
                                    <button
                                        type="button"
                                        className="import-text-button"
                                        onClick={() => setAllValidRows(true)}
                                    >
                                        Select valid
                                    </button>
                                    <button
                                        type="button"
                                        className="import-text-button"
                                        onClick={() => setAllValidRows(false)}
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            </div>

                            <div className="import-preview-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th scope="col">Import</th>
                                            <th scope="col">Row</th>
                                            <th scope="col">Company</th>
                                            <th scope="col">Role type</th>
                                            <th scope="col">Role</th>
                                            <th scope="col">Stipend</th>
                                            <th scope="col">CTC</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Stage</th>
                                            <th scope="col">Review</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {previewRows.map((row) => (
                                            <SheetRowPreview
                                                key={row.sourceRow}
                                                row={row}
                                                mapping={mapping}
                                                selected={selectedRows.has(row.sourceRow)}
                                                ctcUnitChoice={
                                                    ctcUnitChoices[row.sourceRow] ?? "unconfirmed"
                                                }
                                                roleTypeChoice={
                                                    roleTypeChoices[row.sourceRow] ?? "unconfirmed"
                                                }
                                                onSelect={(checked) =>
                                                    setRowSelected(row.sourceRow, checked)
                                                }
                                                onCtcUnitChange={(choice) =>
                                                    setCtcUnitChoice(row.sourceRow, choice)
                                                }
                                                onRoleTypeChange={(choice) =>
                                                    setRoleTypeChoice(row.sourceRow, choice)
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>

                                {previewRows.length === 0 && (
                                    <p className="import-empty-preview">
                                        No data rows were found below the selected header row.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            <footer className="import-wizard__footer">
                <button
                    type="button"
                    className="form-button form-button--secondary"
                    onClick={onCancel}
                >
                    Cancel
                </button>

                <button
                    type="button"
                    className="form-button form-button--primary"
                    disabled={
                        !workbook ||
                        selectedValidRows.length === 0 ||
                        tooManyRows
                    }
                    onClick={commitImport}
                >
                    Import {selectedValidRows.length} selected
                </button>
            </footer>
        </section>
    );
}