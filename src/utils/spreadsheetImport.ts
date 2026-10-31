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
export type CurrencyMode = "auto" | "fixed";

export type ParsedImportRow = {
    draft: ApplicationDraft | null;
    errors: string[];
    warnings: string[];
    needsCtcUnitConfirmation: boolean;
    ambiguousCtcValue: string | null;
    needsRoleTypeConfirmation: boolean;
    roleType: RoleType | null;
    currency: CurrencyCode;
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
            help: "Used to infer role type. Headers such as Stipend (KPM) automatically convert values from thousands to full monthly amounts.",
        },
        {
            field: "ctc",
            label: "Annual CTC",
            required: false,
            help: "Used to infer role type. Headers such as CTC (LPA) automatically convert values from lakhs to full annual amounts.",
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
            help: "Optional per-row currency override when automatic detection is enabled.",
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

type CurrencyDetection = {
    currency: CurrencyCode | null;
    ambiguous: boolean;
};

const SPECIFIC_CURRENCY_SYMBOLS: Array<{
    symbol: string;
    currency: CurrencyCode;
}> = [
        { symbol: "US$", currency: "USD" },
        { symbol: "CA$", currency: "CAD" },
        { symbol: "C$", currency: "CAD" },
        { symbol: "AU$", currency: "AUD" },
        { symbol: "A$", currency: "AUD" },
        { symbol: "S$", currency: "SGD" },
        { symbol: "HK$", currency: "HKD" },
        { symbol: "NZ$", currency: "NZD" },
    ];

const UNIQUE_CURRENCY_SYMBOLS: Array<{
    symbol: string;
    currency: CurrencyCode;
}> = [
        { symbol: "₹", currency: "INR" },
        { symbol: "€", currency: "EUR" },
        { symbol: "£", currency: "GBP" },
        { symbol: "د.إ", currency: "AED" },
    ];

function textOf(value: unknown): string {
    if (value === null || value === undefined) return "";

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

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
    return normalize(value)
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
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

/**
 * Matches headers with additional unit or currency information.
 *
 * Examples:
 * - Company Name
 * - CTC (LPA)
 * - Stipend (KPM)
 * - Monthly Stipend (INR, KPM)
 * - Annual Salary (USD)
 */
export function suggestColumnMapping(
    headers: string[],
): ColumnMapping {
    const result: ColumnMapping = {
        ...EMPTY_COLUMN_MAPPING,
    };

    const usedColumns = new Set<number>();

    for (const fieldInfo of IMPORT_FIELD_INFO) {
        const field = fieldInfo.field;

        const aliases = HEADER_ALIASES[field]
            .map(normalizeHeader)
            .sort((a, b) => b.length - a.length);

        const matchedIndex = headers.findIndex((header, index) => {
            if (usedColumns.has(index)) return false;

            const normalized = normalizeHeader(header);

            return aliases.some(
                (alias) =>
                    normalized === alias ||
                    normalized.startsWith(`${alias} `) ||
                    normalized.endsWith(` ${alias}`),
            );
        });

        if (matchedIndex !== -1) {
            result[field] = matchedIndex;
            usedColumns.add(matchedIndex);
        }
    }

    return result;
}

/**
 * Detects a currency from a value or header.
 *
 * Generic symbols such as $ and ¥ are deliberately treated as
 * ambiguous. The selected fallback currency is used instead,
 * with a warning asking the user to review the result.
 */
function detectCurrencyInText(
    value: unknown,
): CurrencyDetection {
    const raw = textOf(value);

    if (!raw) {
        return {
            currency: null,
            ambiguous: false,
        };
    }

    const upper = raw.toUpperCase();

    // Explicit ISO codes take priority over symbols.
    for (const code of CURRENCY_CODES) {
        const pattern = new RegExp(`\\b${code}\\b`, "i");

        if (pattern.test(upper)) {
            return {
                currency: code,
                ambiguous: false,
            };
        }
    }

    // Country-specific symbols are more reliable than generic symbols.
    for (const item of SPECIFIC_CURRENCY_SYMBOLS) {
        if (upper.includes(item.symbol.toUpperCase())) {
            return {
                currency: item.currency,
                ambiguous: false,
            };
        }
    }

    // Unambiguous symbols.
    for (const item of UNIQUE_CURRENCY_SYMBOLS) {
        if (raw.includes(item.symbol)) {
            return {
                currency: item.currency,
                ambiguous: false,
            };
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
            return {
                currency,
                ambiguous: false,
            };
        }
    }

    // These symbols are shared by multiple currencies.
    if (
        raw.includes("$") ||
        raw.includes("¥") ||
        raw.includes("₨")
    ) {
        return {
            currency: null,
            ambiguous: true,
        };
    }

    return {
        currency: null,
        ambiguous: false,
    };
}

type CurrencyResolution = {
    currency: CurrencyCode;
    warnings: string[];
};

function distinctCurrencies(
    detections: CurrencyDetection[],
): CurrencyCode[] {
    return [
        ...new Set(
            detections
                .map((detection) => detection.currency)
                .filter(
                    (currency): currency is CurrencyCode =>
                        currency !== null,
                ),
        ),
    ];
}

/**
 * Currency precedence in automatic mode:
 *
 * 1. Explicit mapped currency for the row.
 * 2. Currency found in the compensation values.
 * 3. Currency found in the compensation headers.
 * 4. Selected fallback currency.
 *
 * Conflicting or ambiguous signals generate warnings.
 */
function resolveCurrency(
    mappedValue: unknown,
    currencyColumnMapped: boolean,
    stipendValue: unknown,
    ctcValue: unknown,
    stipendHeader: string,
    ctcHeader: string,
    fallback: CurrencyCode,
    mode: CurrencyMode,
): CurrencyResolution {
    const warnings: string[] = [];

    if (mode === "fixed") {
        return {
            currency: fallback,
            warnings,
        };
    }

    const explicitCurrencyText = textOf(mappedValue);

    if (currencyColumnMapped && explicitCurrencyText) {
        const detection = detectCurrencyInText(explicitCurrencyText);

        if (detection.currency) {
            return {
                currency: detection.currency,
                warnings,
            };
        }

        if (detection.ambiguous) {
            warnings.push(
                `Currency value "${explicitCurrencyText}" is ambiguous. Automatic detection and the fallback currency were used.`,
            );
        } else {
            warnings.push(
                `Currency "${explicitCurrencyText}" was not recognized. Automatic detection and the fallback currency were used instead.`,
            );
        }
    }

    const valueDetections = [
        detectCurrencyInText(stipendValue),
        detectCurrencyInText(ctcValue),
    ];

    const currenciesInValues = distinctCurrencies(valueDetections);

    const headerDetections = [
        detectCurrencyInText(stipendHeader),
        detectCurrencyInText(ctcHeader),
    ];

    const currenciesInHeaders = distinctCurrencies(headerDetections);

    if (currenciesInValues.length > 1) {
        warnings.push(
            `Conflicting currencies were found in the compensation values. ${fallback} was used; review this row.`,
        );

        return {
            currency: fallback,
            warnings,
        };
    }

    if (currenciesInHeaders.length > 1) {
        warnings.push(
            `Conflicting currencies were found in the compensation headers. ${fallback} was used; review this row.`,
        );

        return {
            currency: fallback,
            warnings,
        };
    }

    const valueCurrency = currenciesInValues[0] ?? null;
    const headerCurrency = currenciesInHeaders[0] ?? null;

    if (
        valueCurrency &&
        headerCurrency &&
        valueCurrency !== headerCurrency
    ) {
        warnings.push(
            `The compensation value indicates ${valueCurrency}, while the column header indicates ${headerCurrency}. The value's currency was used; review this row.`,
        );
    }

    if (valueCurrency) {
        if (
            valueDetections.some((detection) => detection.ambiguous)
        ) {
            warnings.push(
                "An additional ambiguous currency symbol was found in a compensation value. Review this row.",
            );
        }

        return {
            currency: valueCurrency,
            warnings,
        };
    }

    if (headerCurrency) {
        return {
            currency: headerCurrency,
            warnings,
        };
    }

    const hasAmbiguousSignal = [
        ...valueDetections,
        ...headerDetections,
    ].some((detection) => detection.ambiguous);

    if (hasAmbiguousSignal) {
        warnings.push(
            `A currency symbol such as $, ¥, or ₨ could not be identified reliably. ${fallback} was used; review this row.`,
        );
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

function headerSpecifiesThousandsPerMonth(
    header: string,
): boolean {
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
        /\d[\d,]*(?:\.\d+)?\s*k\b/i.test(value) ||
        /\bKPM\b/i.test(value) ||
        /\bTHOUSANDS?\b/i.test(value)
    );
}

function cellSpecifiesFullAnnualAmount(value: string): boolean {
    return /\b(per year|per annum|annually|annual)\b/i.test(value);
}

function emptyCompensationResult(): CompensationParse {
    return {
        value: null,
        isNotApplicable: false,
        needsUnitConfirmation: false,
        ambiguousValue: null,
        errors: [],
        warnings: [],
    };
}

function invalidCompensation(
    message: string,
): CompensationParse {
    return {
        ...emptyCompensationResult(),
        errors: [message],
    };
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
        return emptyCompensationResult();
    }

    if (isNotApplicable(raw)) {
        return {
            ...emptyCompensationResult(),
            isNotApplicable: true,
        };
    }

    if (raw === "" || isTbd(raw)) {
        return {
            ...emptyCompensationResult(),
            value: { kind: "tbd" },
        };
    }

    const isCtc = field === "ctc";

    const lpaInCell = isCtc && cellSpecifiesLpa(raw);
    const lpaInHeader = isCtc && headerSpecifiesLpa(sourceHeader);

    const thousandsInCell = cellSpecifiesThousands(raw);

    const thousandsInHeader =
        field === "stipend" &&
        headerSpecifiesThousandsPerMonth(sourceHeader);

    const fullAnnualInCell =
        isCtc && cellSpecifiesFullAnnualAmount(raw);

    const label = isCtc ? "CTC" : "Stipend";

    const amounts = parseNumericAmounts(raw);

    if (amounts.length === 0) {
        return invalidCompensation(
            `${label} value "${raw}" could not be read as an amount, range, NA, or TBD.`,
        );
    }

    if (amounts.length > 2) {
        return invalidCompensation(
            `${label} value "${raw}" contains too many numbers. Use a single amount or a two-value range.`,
        );
    }

    if (
        amounts.some(
            (amount) => !Number.isFinite(amount) || amount < 0,
        )
    ) {
        return invalidCompensation(
            `${label} must be a valid non-negative amount.`,
        );
    }

    // Conflicting unit signals should not silently multiply values.
    if (
        isCtc &&
        lpaInHeader &&
        (thousandsInCell || fullAnnualInCell) &&
        !lpaInCell
    ) {
        return invalidCompensation(
            `The CTC header "${sourceHeader}" indicates LPA, but the cell "${raw}" appears to specify a different unit. Correct the header or cell value before importing.`,
        );
    }

    const ctcHasExplicitUnit =
        lpaInCell ||
        lpaInHeader ||
        thousandsInCell ||
        fullAnnualInCell;

    // Small CTC numbers can represent either full amounts or LPA.
    // Check both single values and ranges.
    const hasSmallCtcAmount =
        isCtc &&
        amounts.some((amount) => amount > 0 && amount < 10000);

    if (
        hasSmallCtcAmount &&
        !ctcHasExplicitUnit &&
        unitChoice === "unconfirmed"
    ) {
        return {
            ...emptyCompensationResult(),
            needsUnitConfirmation: true,
            ambiguousValue: raw,
        };
    }

    let factor = 1;

    if (isCtc) {
        if (lpaInCell || lpaInHeader) {
            factor = 100000;
        } else if (thousandsInCell) {
            factor = 1000;
        } else if (unitChoice === "lpa") {
            factor = 100000;
        }
    } else if (thousandsInCell || thousandsInHeader) {
        factor = 1000;
    }

    const converted = amounts.map((amount) => amount * factor);

    if (
        converted.some(
            (amount) => !Number.isFinite(amount) || amount < 0,
        )
    ) {
        return invalidCompensation(
            `${label} must be a valid non-negative amount.`,
        );
    }

    if (converted.length === 2 && converted[0] > converted[1]) {
        return invalidCompensation(
            `${label} range minimum cannot exceed its maximum.`,
        );
    }

    const warnings: string[] = [];

    if (lpaInHeader) {
        warnings.push(
            `The CTC header "${sourceHeader}" indicates LPA. The value was multiplied by 100,000.`,
        );
    } else if (lpaInCell) {
        warnings.push(
            `The value "${raw}" specifies LPA and was multiplied by 100,000.`,
        );
    }

    if (thousandsInHeader) {
        warnings.push(
            `The stipend header "${sourceHeader}" indicates thousands per month. The value was multiplied by 1,000.`,
        );
    } else if (thousandsInCell && !lpaInCell) {
        warnings.push(
            `The value "${raw}" specifies thousands and was multiplied by 1,000.`,
        );
    }

    if (
        isCtc &&
        hasSmallCtcAmount &&
        !ctcHasExplicitUnit &&
        unitChoice === "annual"
    ) {
        warnings.push(
            `CTC "${raw}" was treated as a full annual amount, not LPA.`,
        );
    }

    const value: Compensation =
        converted.length === 2
            ? {
                kind: "range",
                min: converted[0],
                max: converted[1],
            }
            : {
                kind: "fixed",
                amount: converted[0],
            };

    return {
        value,
        isNotApplicable: false,
        needsUnitConfirmation: false,
        ambiguousValue: null,
        errors: [],
        warnings,
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

    if (!raw) {
        return {
            value: null,
            error: null,
        };
    }

    const normalized = normalize(raw);

    const value =
        STATUS_ALIASES[normalized] ?? normalized.replace(/ /g, "-");

    const allowed =
        section === "college-placement"
            ? [
                "not-eligible",
                "applied",
                "not-applied",
                "placed",
                "not-placed",
            ]
            : ["applied", "placed", "not-placed"];

    if (allowed.includes(value)) {
        return {
            value,
            error: null,
        };
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

    if (!raw) {
        return {
            value: null,
            error: null,
        };
    }

    const normalized = normalize(raw);

    const value =
        STAGE_ALIASES[normalized] ?? normalized.replace(/ /g, "-");

    const allowed =
        section === "college-placement"
            ? ["screening", "ppt", "oa", "interview", "offer", "nothing"]
            : ["screening", "oa", "interview", "offer"];

    if (allowed.includes(value)) {
        return {
            value,
            error: null,
        };
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

    if (!stipendMapped && !ctcMapped) {
        return null;
    }

    const stipendText = textOf(stipendValue);
    const ctcText = textOf(ctcValue);

    const stipendNA =
        stipendMapped && isNotApplicable(stipendValue);

    const ctcNA =
        ctcMapped && isNotApplicable(ctcValue);

    if (stipendMapped && !ctcMapped) {
        return stipendNA ? null : "internship";
    }

    if (!stipendMapped && ctcMapped) {
        return ctcNA ? null : "full-time";
    }

    if (
        (stipendNA && ctcNA) ||
        (!stipendText && !ctcText)
    ) {
        return null;
    }

    if (stipendNA) {
        return "full-time";
    }

    if (ctcNA) {
        return "internship";
    }

    return "internship-plus-full-time";
}

function applicableCompensation(
    parsed: CompensationParse,
    label: string,
    warnings: string[],
): Compensation {
    if (parsed.value !== null) {
        return parsed.value;
    }

    if (parsed.isNotApplicable) {
        warnings.push(
            `${label} was marked NA but is treated as TBD because the selected role type includes it.`,
        );
    }

    return {
        kind: "tbd",
    };
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
    currencyMode: CurrencyMode = "auto",
): ParsedImportRow {
    const errors: string[] = [];
    const warnings: string[] = [];

    const mappedValue = (field: ImportField): unknown => {
        const columnIndex = mapping[field];

        return columnIndex === null
            ? null
            : cells[columnIndex];
    };

    const mappedHeader = (field: ImportField): string => {
        const columnIndex = mapping[field];

        return columnIndex === null
            ? ""
            : sourceHeaders[columnIndex] ?? "";
    };

    if (mapping.companyName === null) {
        errors.push(
            "Map a column to Company name before importing.",
        );
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

    const needsCtcUnitConfirmation =
        ctcParse.needsUnitConfirmation;

    const ambiguousCtcValue = ctcParse.ambiguousValue;

    const currencyResolution = resolveCurrency(
        mappedValue("currency"),
        mapping.currency !== null,
        rawStipend,
        rawCtc,
        mappedHeader("stipend"),
        mappedHeader("ctc"),
        defaultCurrency,
        currencyMode,
    );

    warnings.push(...currencyResolution.warnings);

    const status = parseStatus(
        mappedValue("status"),
        section,
    );

    const stage = parseStage(
        mappedValue("reachedStage"),
        section,
    );

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
        ): Compensation =>
            applicableCompensation(parsed, label, warnings);

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
        currency: currencyResolution.currency,
    };
}