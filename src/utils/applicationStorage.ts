
import type { Application } from "../types/application";
import { validateApplicationDraft } from "./applicationValidation";

export const APPLICATIONS_STORAGE_KEY = "career-circus-applications-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

/**
 * Checks stored data before trusting it.
 * This protects the app against malformed or outdated local storage data.
 */
function isStoredApplication(value: unknown): value is Application {
    if (!isRecord(value)) return false;

    const { id, createdAt, ...draft } = value;

    if (typeof id !== "string" || id.trim() === "") {
        return false;
    }

    if (
        typeof createdAt !== "string" ||
        !Number.isFinite(Date.parse(createdAt))
    ) {
        return false;
    }

    return validateApplicationDraft(draft).valid;
}

/**
 * Loads saved applications.
 *
 * If no saved list exists, returns the supplied initial data.
 * Invalid individual records are ignored.
 */
export function loadApplications(
    initialApplications: Application[],
): Application[] {
    try {
        const stored = localStorage.getItem(APPLICATIONS_STORAGE_KEY);

        if (stored === null) {
            return initialApplications;
        }

        const parsed: unknown = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return initialApplications;
        }

        return parsed.filter(isStoredApplication);
    } catch {
        // If storage is inaccessible or unreadable, keep the app usable.
        return initialApplications;
    }
}

/**
 * Saves the complete application list.
 * Returns false if the browser refuses the write.
 */
export function saveApplications(
    applications: Application[],
): boolean {
    try {
        localStorage.setItem(
            APPLICATIONS_STORAGE_KEY,
            JSON.stringify(applications),
        );

        return true;
    } catch {
        return false;
    }
}
