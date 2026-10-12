
import type {
    CollegePlacementStage,
    CollegePlacementStatus,
    Compensation,
    OffCampusStage,
    OffCampusStatus,
    RoleType,
} from "../types/application";

// Keep these options consistent with our data model.
export const ROLE_TYPES = [
    "internship",
    "full-time",
    "internship-plus-full-time",
] as const satisfies readonly RoleType[];

export const COLLEGE_PLACEMENT_STATUSES = [
    "not-eligible",
    "applied",
    "not-applied",
    "placed",
    "not-placed",
] as const satisfies readonly CollegePlacementStatus[];

export const COLLEGE_PLACEMENT_STAGES = [
    "screening",
    "ppt",
    "oa",
    "interview",
    "offer",
    "nothing",
] as const satisfies readonly CollegePlacementStage[];

export const OFF_CAMPUS_STATUSES = [
    "applied",
    "placed",
    "not-placed",
] as const satisfies readonly OffCampusStatus[];

export const OFF_CAMPUS_STAGES = [
    "screening",
    "oa",
    "interview",
    "offer",
] as const satisfies readonly OffCampusStage[];

export type ValidationResult =
    | { valid: true; errors: [] }
    | { valid: false; errors: string[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isOneOf<T extends readonly string[]>(
    value: unknown,
    options: T,
): value is T[number] {
    return (
        typeof value === "string" &&
        (options as readonly string[]).includes(value)
    );
}

function isNonNegativeNumber(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function validateCompensation(
    value: unknown,
    label: string,
    errors: string[],
): void {
    if (!isRecord(value)) {
        errors.push(`${label} must contain a compensation value or TBD.`);
        return;
    }

    if (value.kind === "tbd") {
        return;
    }

    if (value.kind === "fixed") {
        if (!isNonNegativeNumber(value.amount)) {
            errors.push(`${label} must be a valid non-negative number.`);
        }

        return;
    }

    if (value.kind === "range") {
        const min = value.min;
        const max = value.max;

        const validMin = isNonNegativeNumber(min);
        const validMax = isNonNegativeNumber(max);

        if (!validMin) {
            errors.push(
                `${label} minimum must be a valid non-negative number.`,
            );
        }

        if (!validMax) {
            errors.push(
                `${label} maximum must be a valid non-negative number.`,
            );
        }

        if (
            isNonNegativeNumber(min) &&
            isNonNegativeNumber(max) &&
            min > max
        ) {
            errors.push(
                `${label} minimum cannot exceed its maximum.`,
            );
        }

        return;
    }

    errors.push(`${label} has an invalid compensation type.`);
}

function validateNotApplicable(
    value: unknown,
    label: string,
    errors: string[],
): void {
    if (value !== null) {
        errors.push(`${label} must be NA for the selected role type.`);
    }
}

function validateChoice(
    value: unknown,
    label: string,
    options: readonly string[],
    errors: string[],
): void {
    // Null represents a field that is currently unknown,
    // for example, when an imported spreadsheet omits it.
    if (value === null) {
        return;
    }

    if (!isOneOf(value, options)) {
        errors.push(`${label} contains an invalid or missing selection.`);
    }
}

/**
 * Validates application fields before an entry is saved.
 *
 * Accepts unknown input so that values from forms or
 * spreadsheets are checked at runtime.
 *
 * The draft does not need an ID or timestamps; those
 * will be generated when the application is created.
 */
export function validateApplicationDraft(
    input: unknown,
): ValidationResult {
    if (!isRecord(input)) {
        return {
            valid: false,
            errors: ["Application data must be an object."],
        };
    }

    const errors: string[] = [];

    if (
        typeof input.companyName !== "string" ||
        input.companyName.trim() === ""
    ) {
        errors.push("Company name is required.");
    }

    if (
        typeof input.role !== "string" ||
        input.role.trim() === ""
    ) {
        errors.push("Role is required.");
    }

    const validSection =
        input.section === "college-placement" ||
        input.section === "off-campus";

    if (!validSection) {
        errors.push("Section must be college-placement or off-campus.");
    }

    const validRoleType = isOneOf(input.roleType, ROLE_TYPES);

    if (!validRoleType) {
        errors.push("A valid role type is required.");
    }

    // Validate section-specific dropdown selections.
    if (input.section === "college-placement") {
        validateChoice(
            input.status,
            "Status",
            COLLEGE_PLACEMENT_STATUSES,
            errors,
        );

        validateChoice(
            input.reachedStage,
            "Reached stage",
            COLLEGE_PLACEMENT_STAGES,
            errors,
        );
    } else if (input.section === "off-campus") {
        validateChoice(
            input.status,
            "Status",
            OFF_CAMPUS_STATUSES,
            errors,
        );

        validateChoice(
            input.reachedStage,
            "Reached stage",
            OFF_CAMPUS_STAGES,
            errors,
        );
    }

    // Enforce compensation rules based on role type.
    if (validRoleType) {
        if (input.roleType === "internship") {
            validateCompensation(input.stipend, "Stipend", errors);
            validateNotApplicable(input.ctc, "CTC", errors);
        } else if (input.roleType === "full-time") {
            validateNotApplicable(input.stipend, "Stipend", errors);
            validateCompensation(input.ctc, "CTC", errors);
        } else {
            validateCompensation(input.stipend, "Stipend", errors);
            validateCompensation(input.ctc, "CTC", errors);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}

/**
 * Creates a fixed compensation value after checking the amount.
 */
export function createFixedCompensation(
    amount: number,
): Compensation {
    if (!isNonNegativeNumber(amount)) {
        throw new Error("Amount must be a finite, non-negative number.");
    }

    return { kind: "fixed", amount };
}

/**
 * Creates a range after checking its boundaries.
 */
export function createRangeCompensation(
    min: number,
    max: number,
): Compensation {
    if (!isNonNegativeNumber(min) || !isNonNegativeNumber(max)) {
        throw new Error("Range values must be finite, non-negative numbers.");
    }

    if (min > max) {
        throw new Error("Range minimum cannot exceed its maximum.");
    }

    return { kind: "range", min, max };
}
