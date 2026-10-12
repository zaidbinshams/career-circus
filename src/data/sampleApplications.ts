
import type { Application } from "../types/application";

/**
 * Temporary fictional records for developing the dashboard.
 * These will eventually be replaced with real application data.
 */
export const sampleApplications: Application[] = [
    {
        id: "sample-college-1",
        section: "college-placement",
        companyName: "Acme Technologies",
        role: "Software Engineering Intern",
        roleType: "internship",
        currency: "INR",
        stipend: { kind: "range", min: 20000, max: 30000 },
        ctc: null,
        status: "applied",
        reachedStage: "oa",
        createdAt: "2026-10-10T09:00:00.000Z",
    },
    {
        id: "sample-college-2",
        section: "college-placement",
        companyName: "Northstar Systems",
        role: "Graduate Engineer",
        roleType: "full-time",
        currency: "INR",
        stipend: null,
        ctc: { kind: "fixed", amount: 800000 },
        status: "not-applied",
        reachedStage: "nothing",
        createdAt: "2026-10-11T10:00:00.000Z",
    },
    {
        id: "sample-college-3",
        section: "college-placement",
        companyName: "Orbit Labs",
        role: "Software Developer",
        roleType: "internship-plus-full-time",
        currency: "INR",
        stipend: { kind: "tbd" },
        ctc: { kind: "range", min: 700000, max: 900000 },
        status: "applied",
        reachedStage: "ppt",
        createdAt: "2026-10-12T11:00:00.000Z",
    },
    {
        id: "sample-off-campus-1",
        section: "off-campus",
        companyName: "Brightline Labs",
        role: "Frontend Developer Intern",
        roleType: "internship",
        currency: "USD",
        stipend: { kind: "fixed", amount: 3200 },
        ctc: null,
        status: "applied",
        reachedStage: "interview",
        createdAt: "2026-10-10T12:00:00.000Z",
    },
    {
        id: "sample-off-campus-2",
        section: "off-campus",
        companyName: "Horizon Software",
        role: "Software Engineer",
        roleType: "full-time",
        currency: "GBP",
        stipend: null,
        ctc: { kind: "tbd" },
        status: "applied",
        reachedStage: "screening",
        createdAt: "2026-10-12T13:00:00.000Z",
    },
];
