import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import type { Application } from "../types/application";

import {
    APPLICATIONS_STORAGE_KEY,
    loadApplications,
    saveApplications,
} from "./applicationStorage";

const testApplication: Application = {
    id: "test-application-1",
    section: "college-placement",
    companyName: "Test Company",
    role: "Software Engineer Intern",
    roleType: "internship",
    currency: "INR",
    stipend: { kind: "fixed", amount: 25000 },
    ctc: null,
    status: "applied",
    reachedStage: "oa",
    createdAt: "2026-10-10T09:00:00.000Z",
};

const storedValues = new Map<string, string>();

function installMemoryStorage() {
    vi.stubGlobal("localStorage", {
        getItem(key: string) {
            return storedValues.get(key) ?? null;
        },

        setItem(key: string, value: string) {
            storedValues.set(key, String(value));
        },

        removeItem(key: string) {
            storedValues.delete(key);
        },

        clear() {
            storedValues.clear();
        },
    });
}

describe("application storage", () => {
    beforeEach(() => {
        storedValues.clear();
        installMemoryStorage();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns initial data when no saved list exists", () => {
        const result = loadApplications([testApplication]);

        expect(result).toEqual([testApplication]);
    });

    it("saves and reloads applications", () => {
        expect(saveApplications([testApplication])).toBe(true);

        const result = loadApplications([]);

        expect(result).toEqual([testApplication]);
    });

    it("preserves an explicitly saved empty list", () => {
        expect(saveApplications([])).toBe(true);

        const result = loadApplications([testApplication]);

        expect(result).toEqual([]);
    });

    it("ignores malformed individual records", () => {
        storedValues.set(
            APPLICATIONS_STORAGE_KEY,
            JSON.stringify([
                testApplication,
                { companyName: "Incomplete record" },
                null,
                { ...testApplication, createdAt: "not-a-date" },
            ]),
        );

        const result = loadApplications([]);

        expect(result).toEqual([testApplication]);
    });

    it("removes demo records while preserving user applications", () => {
        const demoApplication = {
            ...testApplication,
            id: "sample-college-1",
            companyName: "Acme Technologies",
        };

        storedValues.set(
            APPLICATIONS_STORAGE_KEY,
            JSON.stringify([demoApplication, testApplication]),
        );

        const result = loadApplications([]);

        expect(result).toEqual([testApplication]);
    });

    it("falls back to initial data when saved JSON is malformed", () => {
        storedValues.set(APPLICATIONS_STORAGE_KEY, "{invalid json");

        const result = loadApplications([testApplication]);

        expect(result).toEqual([testApplication]);
    });

    it("returns false when saving fails", () => {
        vi.stubGlobal("localStorage", {
            getItem() {
                return null;
            },
            setItem() {
                throw new Error("Storage unavailable");
            },
        });

        expect(saveApplications([testApplication])).toBe(false);
    });
});