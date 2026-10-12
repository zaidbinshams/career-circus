
import type {
    Application,
    ApplicationDraft,
} from "../types/application";

import { createApplication } from "./applicationFactory";
import { validateApplicationDraft } from "./applicationValidation";

export type CreateApplicationResult =
    | {
        success: true;
        application: Application;
    }
    | {
        success: false;
        errors: string[];
    };

/**
 * Validates and creates a new application record.
 * Does not persist the record to a database.
 */
export function createValidatedApplication(
    draft: ApplicationDraft,
): CreateApplicationResult {
    const validation = validateApplicationDraft(draft);

    if (!validation.valid) {
        return {
            success: false,
            errors: validation.errors,
        };
    }

    const normalizedDraft: ApplicationDraft = {
        ...draft,
        companyName: draft.companyName.trim(),
        role: draft.role.trim(),
    };

    return {
        success: true,
        application: createApplication(normalizedDraft),
    };
}
