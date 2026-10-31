import {
    CURRENCY_CODES,
    type ApplicationDraft,
    type ApplicationSection,
    type Compensation,
    type CurrencyCode,
    type RoleType,
    type CollegePlacementStage,
    type CollegePlacementStatus,
    type OffCampusStage,
    type OffCampusStatus,
} from "../types/application";
import { validateApplicationDraft } from "./applicationValidation";

export type ImportField =
    | "companyName"
    | "role"
    | "stipend"
    | "ctc"
    | "status"
    | "reachedStage"
    | "currency";

export type ColumnMapping = Record<ImportField, number | null>;

export type CtcUnitChoice = "unconfirmed" | "annual" | "lpa";
export type RoleTypeChoice = RoleType | "unconfirmed";

export type ParsedImportRow = {
    draft: ApplicationDraft | null;
    errors: string[];
    warnings: string[];
    needsCtcUnitConfirmation: boolean;
    ambiguousCtcValue: string | null;
    needsRoleTypeConfirmation: boolean;
    roleType: RoleType | null;
};

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
    companyName: null,
    role: null,
    stipend: null,
    ctc: null,
    status: null,
    reachedStage: null,
    currency: null,
};

export const IMPORT_FIELD_INFO: {
    field: ImportField;
    label: string;
    required: boolean;
    help: string;
}[] = [
        {
            field: "companyName",
            label: "Company name",
            required: true,
            help: "The only required column mapping. Rows without a company name are skipped.",
        },
        {
            field: "role",
            label: "Role / job title",
            required: false,
            help: "Blank or unmapped roles are imported as TBD.",
        },
        {
            field: "stipend",
            label: "Monthly stipend",
            required: false,
            help: "Used to infer role type. Headers such as Stipend (KPM) are used to interpret amounts in thousands per month.",
        },
        {
            field: "ctc",
            label: "Annual CTC",
            required: false,
            help: "Used to infer role type. Headers such as CTC (LPA) automatically convert amounts from lakhs per annum.",
        },
        {
            field: "status",
            label: "Application status",
            required: false,
            help: "Optional. Blank status remains unset.",
        },
        {
            field: "reachedStage",
            label: "Reached stage",
            required: false,
            help: "Optional. Blank stage remains unset.",
        },
        {
            field: "currency",
            label: "Currency",
            required: false,
            help: "Optional per-row currency override. Otherwise, currency is inferred from compensation values and headers, then the fallback currency is used.",
        },
    ];

const STATUS_ALIASES: Record<string, string> = {
    "not eligible": "not-eligible",
    ineligible: "not-eligible",
    applied: "applied",
    "not applied": "not-applied",
    "did not apply": "not-applied",
    "not placed": "not-placed",
    "not selected": "not-placed",
    rejected: "not-placed",
    placed: "placed",
    selected: "placed",
};

const STAGE_ALIASES: Record<string, string> = {
    screening: "screening",
    screened: "screening",
    ppt: "ppt",
    presentation: "ppt",
    oa: "oa",
    "online assessment": "oa",
    assessment: "oa",
    interview: "interview",
    interviewed: "interview",
    offer: "offer",
    offered: "offer",
    nothing: "nothing",
    "not started": "nothing",
    "not reached": "nothing",
    none: "nothing",
};

type CurrencySymbol = {
    symbol: string;
    currency: CurrencyCode;
};

const CURRENCY_SYMBOLS: CurrencySymbol[] = [
    { symbol: "US$", currency: "USD" },
    { symbol: "CA$", currency: "CAD" },
    { symbol: "C$", currency: "CAD" },
    { symbol: "A$", currency: "AUD" },
    { symbol: "AU$", currency: "AUD" },
    { symbol: "S$", currency: "SGD" },
    { symbol: "HK$", currency: "HKD" },
    { symbol: "NZ$", currency: "NZD" },
    { symbol: "₹", currency: "INR" },
    { symbol: "₨", currency: "INR" },
    { symbol: "€", currency: "EUR" },
    { symbol: "£", currency: "GBP" },
    { symbol: "¥", currency: "JPY" },
    { symbol: "$", currency: "USD" },
];

function textOf(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).trim();
}

function normalize(value: unknown): string {
    return textOf(value)
        .toLowerCase()
        .replace(/[‐-‒–—]/g, "-")
        .replace(/[._/]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeHeader(value: string): string {
    return normalize(value).replace(/[^a-z0-9 ]/g, "").trim();
}

function isNotApplicable(value: unknown): boolean {
    return [
        "na",
        "n a",
        "n/a",
        "not applicable",
        "not-applicable",
        "-",
        "—",
    ].includes(normalize(value));
}

function isTbd(value: unknown): boolean {
    return [
        "tbd",
        "to be decided",
        "to be determined",
        "unknown",
        "not disclosed",
        "not specified",
        "pending",
    ].includes(normalize(value));
}

const HEADER_ALIASES: Record<ImportField, string[]> = {
    companyName: [
        "company",
        "company name",
        "employer",
        "organization",
        "organisation",
        "firm",
        "employer name",
    ],
    role: [
        "role",
        "job role",
        "job title",
        "position",
        "designation",
        "profile",
        "job profile",
    ],
    stipend: [
        "stipend",
        "monthly stipend",
        "internship stipend",
        "monthly pay",
        "pay per month",
        "stipend per month",
    ],
    ctc: [
        "ctc",
        "annual ctc",
        "salary",
        "annual salary",
        "package",
        "compensation",
        "salary package",
        "lpa",
        "annual package",
    ],
    status: [
        "status",
        "application status",
        "applied status",
        "placement status",
        "result",
    ],
    reachedStage: [
        "stage",
        "reached stage",
        "current stage",
        "round",
        "interview stage",
        "process stage",
    ],
    currency: [
        "currency",
        "currency code",
        "salary currency",
        "pay currency",
    ],
};

export function suggestColumnMapping(headers: string[]): ColumnMapping {
    const result: ColumnMapping = { ...EMPTY_COLUMN_MAPPING };
    const usedColumns = new Set<number>();

    for (const fieldInfo of IMPORT_FIELD_INFO) {
        const field = fieldInfo.field;

        const aliases = new Set(
            HEADER_ALIASES[field].map(normalizeHeader),
        );

        const exactIndex = headers.findIndex(
            (header, index) =>
                !usedColumns.has(index) &&
                aliases.has(normalizeHeader(header)),
        );

        if (exactIndex !== -1) {
            result[field] = exactIndex;
            usedColumns.add(exactIndex);
        }
    }

    return result;
}

/**
 * Detects a currency explicitly written in a cell or header.
 * It does not guess a currency from a number alone.
 */
function detectCurrencyInText(value: unknown): CurrencyCode | null {
    const raw = textOf(value);

    if (!raw) return null;

    const upper = raw.toUpperCase();

    // Prefer explicit ISO currency codes, which are less ambiguous
    // than symbols such as "$".
    for (const code of CURRENCY_CODES) {
        const codePattern = new RegExp(`\\b${code}\\b`, "i");

        if (codePattern.test(upper)) {
            return code;
        }
    }

    // Match longer symbols first so CA$ and US$ aren't mistaken for "$".
    for (const item of CURRENCY_SYMBOLS) {
        if (upper.includes(item.symbol.toUpperCase())) {
            return item.currency;
        }
    }

    const aliases: Array<[RegExp, CurrencyCode]> = [
        [/\bUS DOLLARS?\b/i, "USD"],
        [/\bCANADIAN DOLLARS?\b/i, "CAD"],
        [/\bAUSTRALIAN DOLLARS?\b/i, "AUD"],
        [/\bSINGAPORE DOLLARS?\b/i, "SGD"],
        [/\bINDIAN RUPEES?\b/i, "INR"],
        [/\bEUROS?\b/i, "EUR"],
        [/\bPOUNDS?\b/i, "GBP"],
        [/\bDIRHAMS?\b/i, "AED"],
        [/\bYUAN\b/i, "CNY"],
        [/\bYEN\b/i, "JPY"],
    ];

    for (const [pattern, currency] of aliases) {
        if (pattern.test(upper)) {
            return currency;
        }
    }

    return null;
}

type CurrencyResolution = {
    currency: CurrencyCode;
    warnings: string[];
};

function distinctCurrencies(
    values: Array<CurrencyCode | null>,
): CurrencyCode[] {
    return [...new Set(values.filter(
        (value): value is CurrencyCode => value !== null,
    ))];
}

/**
 * Currency precedence:
 * 1. An explicit, valid mapped currency value for this row.
 * 2. Currency identified in compensation values.
 * 3. Currency identified in compensation column headers.
 * 4. The selected default/fallback currency.
 *
 * Conflicting detected currencies are not guessed.
 */
function resolveCurrency(
    mappedValue: unknown,
    currencyColumnMapped: boolean,
    stipendValue: unknown,
    ctcValue: unknown,
    stipendHeader: string,
    ctcHeader: string,
    fallback: CurrencyCode,
): CurrencyResolution {
    const warnings: string[] = [];
    const explicitCurrencyText = textOf(mappedValue);

    if (currencyColumnMapped && explicitCurrencyText) {
        const mappedCurrency = detectCurrencyInText(explicitCurrencyText);

        if (mappedCurrency) {
            return {
                currency: mappedCurrency,
                warnings,
            };
        }

        warnings.push(
            `Currency "${explicitCurrencyText}" was not recognized. Automatic detection and the fallback currency were used instead.`,
        );
    }

    const currenciesInValues = distinctCurrencies([
        detectCurrencyInText(stipendValue),
        detectCurrencyInText(ctcValue),
    ]);

    if (currenciesInValues.length > 1) {
        warnings.push(
            `Conflicting currencies were found in the compensation values. ${fallback} was used; review this row.`,
        );

        return {
            currency: fallback,
            warnings,
        };
    }

    if (currenciesInValues.length === 1) {
        return {
            currency: currenciesInValues[0],
            warnings,
        };
    }

    const currenciesInHeaders = distinctCurrencies([
        detectCurrencyInText(stipendHeader),
        detectCurrencyInText(ctcHeader),
    ]);

    if (currenciesInHeaders.length > 1) {
        warnings.push(
            `Conflicting currencies were found in the compensation headers. ${fallback} was used; review this row.`,
        );

        return {
            currency: fallback,
            warnings,
        };
    }

    if (currenciesInHeaders.length === 1) {
        return {
            currency: currenciesInHeaders[0],
            warnings,
        };
    }

    return {
        currency: fallback,
        warnings,
    };
}

type CompensationParse = {
    value: Compensation | null;
    isNotApplicable: boolean;
    needsUnitConfirmation: boolean;
    ambiguousValue: string | null;
    errors: string[];
    warnings: string[];
};

function parseNumericAmounts(value: string): number[] {
    return (value.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((part) =>
        Number(part.replace(/,/g, "")),
    );
}

function headerSpecifiesLpa(header: string): boolean {
    return (
        /\bLPA\b/i.test(header) ||
        /\bLAKHS?\b/i.test(header) ||
        /\bLACS?\b/i.test(header)
    );
}

function headerSpecifiesThousandsPerMonth(header: string): boolean {
    return (
        /\bKPM\b/i.test(header) ||
        /\bK\s*(?:\/|PER)\s*M(?:ONTH)?\b/i.test(header) ||
        /\bTHOUSANDS?\s*(?:\/|PER)\s*MONTH\b/i.test(header) ||
        /\bIN\s+THOUSANDS?\b/i.test(header) ||
        /\b000s?\s*(?:\/|PER)\s*MONTH\b/i.test(header)
    );
}

function cellSpecifiesLpa(value: string): boolean {
    return (
        /\bLPA\b/i.test(value) ||
        /\bLAKHS?\s*(?:PER\s+ANNUM|PER\s+YEAR|ANNUALLY)?\b/i.test(value) ||
        /\bLACS?\s*(?:PER\s+ANNUM|PER\s+YEAR|ANNUALLY)?\b/i.test(value)
    );
}

function cellSpecifiesThousands(value: string): boolean {
    return (
        /k\b/i.test(value) ||
        /\bKPM\b/i.test(value) ||
        /\bTHOUSANDS?\b/i.test(value)
    );
}

function parseCompensation(
    rawValue: unknown,
    field: "stipend" | "ctc",
    unitChoice: CtcUnitChoice,
    mapped: boolean,
    sourceHeader: string,
): CompensationParse {
    const raw = textOf(rawValue);

    if (!mapped) {
        return {
            value: null,
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [],
            warnings: [],
        };
    }

    if (isNotApplicable(raw)) {
        return {
            value: null,
            isNotApplicable: true,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [],
            warnings: [],
        };
    }

    if (raw === "" || isTbd(raw)) {
        return {
            value: { kind: "tbd" },
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [],
            warnings: [],
        };
    }

    const explicitLpaInCell =
        field === "ctc" && cellSpecifiesLpa(raw);

    const lpaInHeader =
        field === "ctc" && headerSpecifiesLpa(sourceHeader);

    const thousandsInCell = cellSpecifiesThousands(raw);

    const thousandsInHeader =
        field === "stipend" &&
        headerSpecifiesThousandsPerMonth(sourceHeader);

    const amounts = parseNumericAmounts(raw);

    if (
        amounts.length === 0 ||
        amounts.some((amount) => !Number.isFinite(amount))
    ) {
        return {
            value: null,
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [
                `${field === "ctc" ? "CTC" : "Stipend"} value "${raw}" could not be read as an amount, range, NA, or TBD.`,
            ],
            warnings: [],
        };
    }

    // A unit explicitly stated in the cell or header is sufficient.
    // Don't ask for confirmation when the header already says LPA.
    const hasExplicitCtcUnit =
        explicitLpaInCell ||
        lpaInHeader ||
        thousandsInCell ||
        /\b(per year|per annum|annually|annual)\b/i.test(raw);

    if (
        field === "ctc" &&
        amounts.length === 1 &&
        amounts[0] > 0 &&
        amounts[0] < 10000 &&
        !hasExplicitCtcUnit &&
        unitChoice === "unconfirmed"
    ) {
        return {
            value: null,
            isNotApplicable: false,
            needsUnitConfirmation: true,
            ambiguousValue: raw,
            errors: [],
            warnings: [],
        };
    }

    let factor = 1;

    if (explicitLpaInCell || lpaInHeader) {
        factor = 100000;
    } else if (
        thousandsInCell ||
        thousandsInHeader ||
        (field === "ctc" && unitChoice === "lpa")
    ) {
        factor = 1000;

        // LPA is 100,000, not 1,000. The CTC choice below
        // handles LPA separately when there is no header hint.
        if (field === "ctc" && unitChoice === "lpa") {
            factor = 100000;
        }
    }

    const converted = amounts.map((amount) => amount * factor);

    if (
        converted.some(
            (amount) => amount < 0 || !Number.isFinite(amount),
        )
    ) {
        return {
            value: null,
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [
                `${field === "ctc" ? "CTC" : "Stipend"} must be a non-negative amount.`,
            ],
            warnings: [],
        };
    }

    if (converted.length >= 2) {
        const min = converted[0];
        const max = converted[1];

        if (min > max) {
            return {
                value: null,
                isNotApplicable: false,
                needsUnitConfirmation: false,
                ambiguousValue: null,
                errors: [
                    `${field === "ctc" ? "CTC" : "Stipend"} range minimum cannot exceed its maximum.`,
                ],
                warnings: [],
            };
        }

        return {
            value: { kind: "range", min, max },
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [],
            warnings: [],
        };
    }

    if (
        field === "ctc" &&
        amounts[0] > 0 &&
        amounts[0] < 10000 &&
        !hasExplicitCtcUnit &&
        unitChoice === "annual"
    ) {
        return {
            value: { kind: "fixed", amount: converted[0] },
            isNotApplicable: false,
            needsUnitConfirmation: false,
            ambiguousValue: null,
            errors: [],
            warnings: [
                `CTC "${raw}" was treated as a full annual amount, not LPA.`,
            ],
        };
    }

    return {
        value: { kind: "fixed", amount: converted[0] },
        isNotApplicable: false,
        needsUnitConfirmation: false,
        ambiguousValue: null,
        errors: [],
        warnings: [],
    };
}

function parseStatus(
    rawValue: unknown,
    section: ApplicationSection,
): {
    value: string | null;
    error: string | null;
} {
    const raw = textOf(rawValue);

    if (!raw) return { value: null, error: null };

    const normalized = normalize(raw);
    const value = STATUS_ALIASES[normalized] ?? normalized.replace(/ /g, "-");

    const allowed =
        section === "college-placement"
            ? ["not-eligible", "applied", "not-applied", "placed", "not-placed"]
            : ["applied", "placed", "not-placed"];

    if (allowed.includes(value)) {
        return { value, error: null };
    }

    return {
        value: null,
        error: `Status "${raw}" is not valid for ${section === "college-placement"
                ? "College Placements"
                : "Off Campus"
            }.`,
    };
}

function parseStage(
    rawValue: unknown,
    section: ApplicationSection,
): {
    value: string | null;
    error: string | null;
} {
    const raw = textOf(rawValue);

    if (!raw) return { value: null, error: null };

    const normalized = normalize(raw);
    const value = STAGE_ALIASES[normalized] ?? normalized.replace(/ /g, "-");

    const allowed =
        section === "college-placement"
            ? ["screening", "ppt", "oa", "interview", "offer", "nothing"]
            : ["screening", "oa", "interview", "offer"];

    if (allowed.includes(value)) {
        return { value, error: null };
    }

    return {
        value: null,
        error: `Stage "${raw}" is not valid for ${section === "college-placement"
                ? "College Placements"
                : "Off Campus"
            }.`,
    };
}

function inferRoleType(
    mapping: ColumnMapping,
    stipendValue: unknown,
    ctcValue: unknown,
): RoleType | null {
    const stipendMapped = mapping.stipend !== null;
    const ctcMapped = mapping.ctc !== null;

    if (!stipendMapped && !ctcMapped) return null;

    const stipendText = textOf(stipendValue);
    const ctcText = textOf(ctcValue);

    const stipendNA =
        stipendMapped && isNotApplicable(stipendValue);
    const ctcNA = ctcMapped && isNotApplicable(ctcValue);

    if (stipendMapped && !ctcMapped) {
        return stipendNA ? null : "internship";
    }

    if (!stipendMapped && ctcMapped) {
        return ctcNA ? null : "full-time";
    }

    if ((stipendNA && ctcNA) || (!stipendText && !ctcText)) {
        return null;
    }

    if (stipendNA) return "full-time";
    if (ctcNA) return "internship";

    return "internship-plus-full-time";
}

function applicableCompensation(
    parsed: CompensationParse,
    label: string,
    warnings: string[],
): Compensation {
    if (parsed.value !== null) return parsed.value;

    if (parsed.isNotApplicable) {
        warnings.push(
            `${label} was marked NA but is treated as TBD because the selected role type includes it.`,
        );
    }

    return { kind: "tbd" };
}

export function parseImportRow(
    _sourceRow: number,
    cells: unknown[],
    mapping: ColumnMapping,
    section: ApplicationSection,
    defaultCurrency: CurrencyCode,
    ctcUnitChoice: CtcUnitChoice = "unconfirmed",
    roleTypeChoice: RoleTypeChoice = "unconfirmed",
    sourceHeaders: string[] = [],
): ParsedImportRow {
    const errors: string[] = [];
    const warnings: string[] = [];

    const mappedValue = (field: ImportField): unknown => {
        const columnIndex = mapping[field];
        return columnIndex === null ? null : cells[columnIndex];
    };

    const mappedHeader = (field: ImportField): string => {
        const columnIndex = mapping[field];

        if (columnIndex === null) return "";

        return sourceHeaders[columnIndex] ?? "";
    };

    if (mapping.companyName === null) {
        errors.push("Map a column to Company name before importing.");
    }

    const companyName = textOf(mappedValue("companyName"));

    if (mapping.companyName !== null && !companyName) {
        errors.push("Company name is missing.");
    }

    const roleText = textOf(mappedValue("role"));
    const role = roleText || "TBD";

    const rawStipend = mappedValue("stipend");
    const rawCtc = mappedValue("ctc");

    const inferredRoleType = inferRoleType(
        mapping,
        rawStipend,
        rawCtc,
    );

    const roleType =
        roleTypeChoice !== "unconfirmed"
            ? roleTypeChoice
            : inferredRoleType;

    const needsRoleTypeConfirmation = roleType === null;

    const stipendParse = parseCompensation(
        rawStipend,
        "stipend",
        "unconfirmed",
        mapping.stipend !== null,
        mappedHeader("stipend"),
    );

    const ctcParse = parseCompensation(
        rawCtc,
        "ctc",
        ctcUnitChoice,
        mapping.ctc !== null,
        mappedHeader("ctc"),
    );

    errors.push(...stipendParse.errors, ...ctcParse.errors);
    warnings.push(...stipendParse.warnings, ...ctcParse.warnings);

    const needsCtcUnitConfirmation = ctcParse.needsUnitConfirmation;
    const ambiguousCtcValue = ctcParse.ambiguousValue;

    const currencyResolution = resolveCurrency(
        mappedValue("currency"),
        mapping.currency !== null,
        rawStipend,
        rawCtc,
        mappedHeader("stipend"),
        mappedHeader("ctc"),
        defaultCurrency,
    );

    warnings.push(...currencyResolution.warnings);

    const status = parseStatus(mappedValue("status"), section);
    const stage = parseStage(mappedValue("reachedStage"), section);

    if (status.error) errors.push(status.error);
    if (stage.error) errors.push(stage.error);

    let draft: ApplicationDraft | null = null;

    if (
        roleType !== null &&
        !needsCtcUnitConfirmation &&
        errors.length === 0
    ) {
        const compensationFor = (
            parsed: CompensationParse,
            label: string,
        ): Compensation => applicableCompensation(parsed, label, warnings);

        const stipend =
            roleType === "full-time"
                ? null
                : compensationFor(stipendParse, "Stipend");

        const ctc =
            roleType === "internship"
                ? null
                : compensationFor(ctcParse, "CTC");

        if (section === "college-placement") {
            const base = {
                section: "college-placement" as const,
                companyName,
                role,
                currency: currencyResolution.currency,
                status: status.value as CollegePlacementStatus | null,
                reachedStage: stage.value as CollegePlacementStage | null,
            };

            if (roleType === "internship") {
                draft = {
                    ...base,
                    roleType,
                    stipend: stipend as Compensation,
                    ctc: null,
                };
            } else if (roleType === "full-time") {
                draft = {
                    ...base,
                    roleType,
                    stipend: null,
                    ctc: ctc as Compensation,
                };
            } else {
                draft = {
                    ...base,
                    roleType,
                    stipend: stipend as Compensation,
                    ctc: ctc as Compensation,
                };
            }
        } else {
            const base = {
                section: "off-campus" as const,
                companyName,
                role,
                currency: currencyResolution.currency,
                status: status.value as OffCampusStatus | null,
                reachedStage: stage.value as OffCampusStage | null,
            };

            if (roleType === "internship") {
                draft = {
                    ...base,
                    roleType,
                    stipend: stipend as Compensation,
                    ctc: null,
                };
            } else if (roleType === "full-time") {
                draft = {
                    ...base,
                    roleType,
                    stipend: null,
                    ctc: ctc as Compensation,
                };
            } else {
                draft = {
                    ...base,
                    roleType,
                    stipend: stipend as Compensation,
                    ctc: ctc as Compensation,
                };
            }
        }

        const validation = validateApplicationDraft(draft);

        if (!validation.valid) {
            errors.push(...validation.errors);
            draft = null;
        }
    }

    if (
        errors.length > 0 ||
        needsCtcUnitConfirmation ||
        needsRoleTypeConfirmation
    ) {
        draft = null;
    }

    return {
        draft,
        errors,
        warnings,
        needsCtcUnitConfirmation,
        ambiguousCtcValue,
        needsRoleTypeConfirmation,
        roleType,
    };
}