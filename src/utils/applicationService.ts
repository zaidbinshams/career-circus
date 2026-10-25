
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

export type UpdateApplicationResult = CreateApplicationResult;

function normalizeDraft(draft: ApplicationDraft): ApplicationDraft {
    return {
        ...draft,
        companyName: draft.companyName.trim(),
        role: draft.role.trim(),
    };
}

/**
 * Validates and creates a new application.
 * Generates a new ID and creation timestamp.
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

    return {
        success: true,
        application: createApplication(normalizeDraft(draft)),
    };
}

/**
 * Validates and updates an existing application.
 * Preserves its ID and original creation timestamp.
 */
export function updateValidatedApplication(
    existing: Application,
    draft: ApplicationDraft,
): UpdateApplicationResult {
    const validation = validateApplicationDraft(draft);

    if (!validation.valid) {
        return {
            success: false,
            errors: validation.errors,
        };
    }

    const normalizedDraft = normalizeDraft(draft);

    const application: Application = {
        ...normalizedDraft,
        id: existing.id,
        createdAt: existing.createdAt,
    };

    return {
        success: true,
        application,
    };
}
