
import type {
    Application,
    ApplicationDraft,
} from "../types/application";

/**
 * Creates a new application record.
 *
 * The caller supplies application details.
 * This function generates the ID and timestamps.
 */
export function createApplication(
    draft: ApplicationDraft,
): Application {
    return {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
}