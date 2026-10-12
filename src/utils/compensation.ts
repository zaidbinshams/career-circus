
import type {
    Compensation,
    CurrencyCode,
} from "../types/application";

type CompensationField = "stipend" | "ctc";

function formatAmount(
    amount: number,
    currency: CurrencyCode,
): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Stipend amounts are per month.
 * CTC amounts are full annual amounts, not LPA values.
 * Null represents NA; an unknown applicable value is TBD.
 */
export function formatCompensation(
    compensation: Compensation | null,
    field: CompensationField,
    currency: CurrencyCode,
): string {
    if (compensation === null) {
        return "NA";
    }

    if (compensation.kind === "tbd") {
        return "TBD";
    }

    const suffix = field === "stipend" ? "/month" : "/year";

    if (compensation.kind === "fixed") {
        return `${formatAmount(compensation.amount, currency)}${suffix}`;
    }

    return (
        `${formatAmount(compensation.min, currency)}–` +
        `${formatAmount(compensation.max, currency)}${suffix}`
    );
}