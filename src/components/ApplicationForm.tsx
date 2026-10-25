
import { useState, type FormEvent } from "react";
import {
    CURRENCY_CODES,
    type Application,
    type ApplicationDraft,
    type ApplicationSection,
    type CollegePlacementStage,
    type CollegePlacementStatus,
    type Compensation,
    type CurrencyCode,
    type OffCampusStage,
    type OffCampusStatus,
    type RoleType,
} from "../types/application";

import {
    COLLEGE_PLACEMENT_STAGES,
    COLLEGE_PLACEMENT_STATUSES,
    OFF_CAMPUS_STAGES,
    OFF_CAMPUS_STATUSES,
    ROLE_TYPES,
    validateApplicationDraft,
} from "../utils/applicationValidation";

import "./ApplicationForm.css";

type CompensationInput = {
    mode: "fixed" | "range";
    amount: string;
    min: string;
    max: string;
};

type CompensationResult = {
    value: Compensation | null;
    errors: string[];
};

type ApplicationFormProps = {
    initialSection: ApplicationSection;
    initialApplication?: Application | null;
    availableSections: ApplicationSection[];
    onSubmit: (draft: ApplicationDraft) => string[] | void;
    onCancel: () => void;
};

const CURRENCY_NAMES: Record<CurrencyCode, string> = {
    INR: "Indian Rupee",
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    SGD: "Singapore Dollar",
    AED: "UAE Dirham",
    JPY: "Japanese Yen",
    CNY: "Chinese Yuan",
    CHF: "Swiss Franc",
    NZD: "New Zealand Dollar",
    HKD: "Hong Kong Dollar",
    SAR: "Saudi Riyal",
    MYR: "Malaysian Ringgit",
    IDR: "Indonesian Rupiah",
    KRW: "South Korean Won",
    THB: "Thai Baht",
    PHP: "Philippine Peso",
    BDT: "Bangladeshi Taka",
};

const EMPTY_COMPENSATION_INPUT: CompensationInput = {
    mode: "fixed",
    amount: "",
    min: "",
    max: "",
};

const ROLE_LABELS: Record<RoleType, string> = {
    internship: "Internship",
    "full-time": "Full time",
    "internship-plus-full-time": "Internship + full time",
};

const STATUS_LABELS: Record<string, string> = {
    "not-eligible": "Not eligible",
    applied: "Applied",
    "not-applied": "Not applied",
    placed: "Placed",
    "not-placed": "Not placed",
};

const STAGE_LABELS: Record<string, string> = {
    screening: "Screening",
    ppt: "PPT",
    oa: "OA",
    interview: "Interview",
    offer: "Offer",
    nothing: "Nothing",
};

function toCompensationInput(
    value: Compensation | null | undefined,
): CompensationInput {
    if (!value || value.kind === "tbd") {
        return { ...EMPTY_COMPENSATION_INPUT };
    }

    if (value.kind === "fixed") {
        return {
            mode: "fixed",
            amount: String(value.amount),
            min: "",
            max: "",
        };
    }

    return {
        mode: "range",
        amount: "",
        min: String(value.min),
        max: String(value.max),
    };
}

function readCompensation(
    input: CompensationInput,
    fieldLabel: string,
): CompensationResult {
    if (input.mode === "fixed") {
        if (input.amount.trim() === "") {
            return { value: { kind: "tbd" }, errors: [] };
        }

        const amount = Number(input.amount);

        if (!Number.isFinite(amount) || amount < 0) {
            return {
                value: null,
                errors: [`${fieldLabel} must be a non-negative number.`],
            };
        }

        return {
            value: { kind: "fixed", amount },
            errors: [],
        };
    }

    const minText = input.min.trim();
    const maxText = input.max.trim();

    if (minText === "" && maxText === "") {
        return { value: { kind: "tbd" }, errors: [] };
    }

    if (minText === "" || maxText === "") {
        return {
            value: null,
            errors: [
                `${fieldLabel}: enter both range values or leave both empty for TBD.`,
            ],
        };
    }

    const min = Number(minText);
    const max = Number(maxText);

    if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 0 ||
        max < 0
    ) {
        return {
            value: null,
            errors: [
                `${fieldLabel} range values must be non-negative numbers.`,
            ],
        };
    }

    if (min > max) {
        return {
            value: null,
            errors: [`${fieldLabel} minimum cannot exceed its maximum.`],
        };
    }

    return {
        value: { kind: "range", min, max },
        errors: [],
    };
}

function CompensationFields({
    label,
    unit,
    value,
    onChange,
}: {
    label: string;
    unit: string;
    value: CompensationInput;
    onChange: (next: CompensationInput) => void;
}) {
    const modeButtonClass = (mode: "fixed" | "range") =>
        value.mode === mode
            ? "compensation-mode__button compensation-mode__button--active"
            : "compensation-mode__button";

    return (
        <fieldset className="form-field compensation-field">
            <legend>{label}</legend>

            <div className="compensation-mode" aria-label={`${label} input mode`}>
                <button
                    type="button"
                    className={modeButtonClass("fixed")}
                    aria-pressed={value.mode === "fixed"}
                    onClick={() => onChange({ ...value, mode: "fixed" })}
                >
                    Fixed amount
                </button>

                <button
                    type="button"
                    className={modeButtonClass("range")}
                    aria-pressed={value.mode === "range"}
                    onClick={() => onChange({ ...value, mode: "range" })}
                >
                    Range
                </button>
            </div>

            {value.mode === "fixed" ? (
                <label className="input-with-unit">
                    <span className="sr-only">{label} amount</span>
                    <input
                        type="number"
                        min="0"
                        step="any"
                        value={value.amount}
                        onChange={(event) =>
                            onChange({ ...value, amount: event.target.value })
                        }
                        placeholder={`Amount ${unit}`}
                    />
                    <span className="input-unit">{unit}</span>
                </label>
            ) : (
                <div className="range-inputs">
                    <label>
                        <span className="sr-only">{label} minimum</span>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={value.min}
                            onChange={(event) =>
                                onChange({ ...value, min: event.target.value })
                            }
                            placeholder="Minimum"
                        />
                    </label>

                    <span className="range-separator" aria-hidden="true">
                        –
                    </span>

                    <label>
                        <span className="sr-only">{label} maximum</span>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={value.max}
                            onChange={(event) =>
                                onChange({ ...value, max: event.target.value })
                            }
                            placeholder="Maximum"
                        />
                    </label>
                </div>
            )}

            <p className="form-hint">
                {value.mode === "fixed"
                    ? `Leave empty for TBD. Values are entered ${unit === "/month" ? "per month" : "per year"}.`
                    : `Enter both range values, or leave both empty for TBD. Values are ${unit === "/month" ? "monthly" : "annual"}.`}
            </p>
        </fieldset>
    );
}

export default function ApplicationForm({
    initialSection,
    initialApplication = null,
    availableSections,
    onSubmit,
    onCancel,
}: ApplicationFormProps) {
    const [section, setSection] = useState<ApplicationSection>(
        () => initialApplication?.section ?? initialSection,
    );
    const [companyName, setCompanyName] = useState(
        () => initialApplication?.companyName ?? "",
    );
    const [role, setRole] = useState(
        () => initialApplication?.role ?? "",
    );
    const [roleType, setRoleType] = useState<RoleType | "">(
        () => initialApplication?.roleType ?? "",
    );
    const [currency, setCurrency] = useState<CurrencyCode>(
        () => initialApplication?.currency ?? "INR",
    );
    const [status, setStatus] = useState(
        () => initialApplication?.status ?? "",
    );
    const [stage, setStage] = useState(
        () => initialApplication?.reachedStage ?? "",
    );
    const [stipend, setStipend] = useState<CompensationInput>(() =>
        toCompensationInput(initialApplication?.stipend),
    );
    const [ctc, setCtc] = useState<CompensationInput>(() =>
        toCompensationInput(initialApplication?.ctc),
    );
    const [errors, setErrors] = useState<string[]>([]);

    const isEditing = initialApplication !== null;

    const statusOptions =
        section === "college-placement"
            ? COLLEGE_PLACEMENT_STATUSES
            : OFF_CAMPUS_STATUSES;

    const stageOptions =
        section === "college-placement"
            ? COLLEGE_PLACEMENT_STAGES
            : OFF_CAMPUS_STAGES;

    const needsStipend =
        roleType === "internship" ||
        roleType === "internship-plus-full-time";

    const needsCtc =
        roleType === "full-time" ||
        roleType === "internship-plus-full-time";

    function changeSection(nextSection: ApplicationSection) {
        setSection(nextSection);
        setStatus("");
        setStage("");
        setErrors([]);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const nextErrors: string[] = [];

        if (!companyName.trim()) {
            nextErrors.push("Company name is required.");
        }

        if (!role.trim()) {
            nextErrors.push("Role is required.");
        }

        if (!roleType) {
            nextErrors.push("Select a role type.");
        }

        if (!status) {
            nextErrors.push("Select a status.");
        }

        if (!stage) {
            nextErrors.push("Select a reached stage.");
        }

        let stipendValue: Compensation | null = null;
        let ctcValue: Compensation | null = null;

        if (needsStipend) {
            const result = readCompensation(stipend, "Stipend");
            stipendValue = result.value;
            nextErrors.push(...result.errors);
        }

        if (needsCtc) {
            const result = readCompensation(ctc, "CTC");
            ctcValue = result.value;
            nextErrors.push(...result.errors);
        }

        if (nextErrors.length > 0 || !roleType || !status || !stage) {
            setErrors(nextErrors);
            return;
        }

        const commonFields = {
            companyName: companyName.trim(),
            role: role.trim(),
            currency,
        };

        let draft: ApplicationDraft;

        if (section === "college-placement") {
            const collegeFields = {
                ...commonFields,
                section: "college-placement" as const,
                status: status as CollegePlacementStatus,
                reachedStage: stage as CollegePlacementStage,
            };

            if (roleType === "internship") {
                draft = {
                    ...collegeFields,
                    roleType,
                    stipend: stipendValue!,
                    ctc: null,
                };
            } else if (roleType === "full-time") {
                draft = {
                    ...collegeFields,
                    roleType,
                    stipend: null,
                    ctc: ctcValue!,
                };
            } else {
                draft = {
                    ...collegeFields,
                    roleType,
                    stipend: stipendValue!,
                    ctc: ctcValue!,
                };
            }
        } else {
            const offCampusFields = {
                ...commonFields,
                section: "off-campus" as const,
                status: status as OffCampusStatus,
                reachedStage: stage as OffCampusStage,
            };

            if (roleType === "internship") {
                draft = {
                    ...offCampusFields,
                    roleType,
                    stipend: stipendValue!,
                    ctc: null,
                };
            } else if (roleType === "full-time") {
                draft = {
                    ...offCampusFields,
                    roleType,
                    stipend: null,
                    ctc: ctcValue!,
                };
            } else {
                draft = {
                    ...offCampusFields,
                    roleType,
                    stipend: stipendValue!,
                    ctc: ctcValue!,
                };
            }
        }

        const validation = validateApplicationDraft(draft);

        if (!validation.valid) {
            setErrors(validation.errors);
            return;
        }

        const submissionErrors = onSubmit(draft);

        if (submissionErrors && submissionErrors.length > 0) {
            setErrors(submissionErrors);
            return;
        }

        setErrors([]);
    }

    return (
        <form className="application-form" onSubmit={handleSubmit} noValidate>
            <header className="application-form__header">
                <div>
                    <p className="form-eyebrow">
                        {isEditing ? "UPDATE RECORD" : "NEW RECORD"}
                    </p>
                    <h2>{isEditing ? "Edit application" : "Add application"}</h2>
                    <p className="form-description">
                        {isEditing
                            ? "Update the details for this opportunity."
                            : "Enter the details for this opportunity."}
                    </p>
                </div>

                <button
                    type="button"
                    className="form-close"
                    onClick={onCancel}
                    aria-label="Close form"
                >
                    ×
                </button>
            </header>

            <fieldset className="form-field">
                <legend>Section</legend>

                {availableSections.length > 1 ? (
                    <div className="form-section-switch">
                        {availableSections.map((option) => (
                            <button
                                type="button"
                                key={option}
                                className={
                                    section === option
                                        ? "form-section-button form-section-button--active"
                                        : "form-section-button"
                                }
                                aria-pressed={section === option}
                                onClick={() => changeSection(option)}
                            >
                                {option === "college-placement"
                                    ? "College Placements"
                                    : "Off Campus"}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="form-section-summary">
                        {section === "college-placement"
                            ? "College Placements"
                            : "Off Campus"}
                    </p>
                )}
            </fieldset>

            <div className="form-grid">
                <label className="form-field">
                    <span>Company name</span>
                    <input
                        autoFocus
                        required
                        type="text"
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="e.g. Acme Technologies"
                    />
                </label>

                <label className="form-field">
                    <span>Role</span>
                    <input
                        required
                        type="text"
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        placeholder="e.g. Software Engineer"
                    />
                </label>

                <fieldset className="form-field form-field--wide">
                    <legend>Role type</legend>
                    <div className="role-type-options">
                        {ROLE_TYPES.map((option) => (
                            <button
                                type="button"
                                key={option}
                                className={
                                    roleType === option
                                        ? "role-type-button role-type-button--active"
                                        : "role-type-button"
                                }
                                aria-pressed={roleType === option}
                                onClick={() => {
                                    setRoleType(option);
                                    setErrors([]);
                                }}
                            >
                                {ROLE_LABELS[option]}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <label className="form-field form-field--wide">
                    <span>Currency</span>
                    <select
                        value={currency}
                        onChange={(event) =>
                            setCurrency(event.target.value as CurrencyCode)
                        }
                    >
                        {CURRENCY_CODES.map((code) => (
                            <option key={code} value={code}>
                                {CURRENCY_NAMES[code]} ({code})
                            </option>
                        ))}
                    </select>
                </label>

                {needsStipend && (
                    <div className="form-field">
                        <CompensationFields
                            label="Stipend"
                            unit="/month"
                            value={stipend}
                            onChange={setStipend}
                        />
                    </div>
                )}

                {needsCtc && (
                    <div className="form-field">
                        <CompensationFields
                            label="CTC"
                            unit="/year"
                            value={ctc}
                            onChange={setCtc}
                        />
                    </div>
                )}

                {!roleType && (
                    <p className="form-hint form-field--wide">
                        Select a role type to show the applicable compensation fields.
                    </p>
                )}

                <label className="form-field">
                    <span>Status</span>
                    <select
                        required
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value="">Select status</option>
                        {statusOptions.map((option) => (
                            <option key={option} value={option}>
                                {STATUS_LABELS[option] ?? option}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="form-field">
                    <span>Reached stage</span>
                    <select
                        required
                        value={stage}
                        onChange={(event) => setStage(event.target.value)}
                    >
                        <option value="">Select stage</option>
                        {stageOptions.map((option) => (
                            <option key={option} value={option}>
                                {STAGE_LABELS[option] ?? option}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {errors.length > 0 && (
                <div className="form-errors" role="alert">
                    <p>Please correct the following:</p>
                    <ul>
                        {errors.map((error, index) => (
                            <li key={`${error}-${index}`}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            <footer className="application-form__footer">
                <button
                    type="button"
                    className="form-button form-button--secondary"
                    onClick={onCancel}
                >
                    Cancel
                </button>

                <button type="submit" className="form-button form-button--primary">
                    {isEditing ? "Save changes" : "Add application"}
                </button>
            </footer>
        </form>
    );
}
