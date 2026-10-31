import type { Application } from "../types/application";
import { validateApplicationDraft } from "./applicationValidation";

export const APPLICATIONS_STORAGE_KEY = "career-circus-applications-v1";

/**
 * IDs belonging to the fictional records previously used during development.
 * These are removed from existing browser storage without affecting
 * applications created by users.
 */
const DEMO_APPLICATION_IDS: ReadonlySet<string> = new Set([
    "sample-college-1",
    "sample-college-2",
    "sample-college-3",
    "sample-off-campus-1",
    "sample-off-campus-2",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

/**
 * Checks stored data before trusting it.
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
 * Removes old development sample records while preserving
 * genuine user-created applications.
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

        return parsed
            .filter(isStoredApplication)
            .filter((application) => !DEMO_APPLICATION_IDS.has(application.id));
    } catch {
        return initialApplications;
    }
}

/**
 * Saves the complete application list.
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