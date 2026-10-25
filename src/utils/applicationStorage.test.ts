
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { sampleApplications } from "../data/sampleApplications";
import {
    APPLICATIONS_STORAGE_KEY,
    loadApplications,
    saveApplications,
} from "./applicationStorage";

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

    it("returns initial sample data when no saved list exists", () => {
        const result = loadApplications(sampleApplications);

        expect(result).toEqual(sampleApplications);
    });

    it("saves and reloads applications", () => {
        expect(saveApplications(sampleApplications)).toBe(true);

        const result = loadApplications([]);

        expect(result).toEqual(sampleApplications);
    });

    it("preserves an explicitly saved empty list", () => {
        expect(saveApplications([])).toBe(true);

        const result = loadApplications(sampleApplications);

        expect(result).toEqual([]);
    });

    it("ignores malformed individual records", () => {
        const validApplication = sampleApplications[0];

        storedValues.set(
            APPLICATIONS_STORAGE_KEY,
            JSON.stringify([
                validApplication,
                { companyName: "Incomplete record" },
                null,
                { ...validApplication, createdAt: "not-a-date" },
            ]),
        );

        const result = loadApplications([]);

        expect(result).toEqual([validApplication]);
    });

    it("falls back to initial data when saved JSON is malformed", () => {
        storedValues.set(APPLICATIONS_STORAGE_KEY, "{invalid json");

        const result = loadApplications(sampleApplications);

        expect(result).toEqual(sampleApplications);
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

        expect(saveApplications(sampleApplications)).toBe(false);
    });
});
