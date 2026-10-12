
/**
 * Shared types for Career Circus.
 * These describe the data model, not the UI.
 */

export type ApplicationSection =
    | "college-placement"
    | "off-campus";

export type RoleType =
    | "internship"
    | "full-time"
    | "internship-plus-full-time";

/**
 * Compensation is either:
 * - TBD: applicable, but the value is unknown
 * - Fixed: one known amount
 * - Range: a minimum and maximum amount
 *
 * A null compensation field means NA (not applicable).
 */
export type Compensation =
    | {
        kind: "tbd";
    }
    | {
        kind: "fixed";
        amount: number;
    }
    | {
        kind: "range";
        min: number;
        max: number;
    };

// College placement options
export type CollegePlacementStatus =
    | "not-eligible"
    | "applied"
    | "not-applied"
    | "placed"
    | "not-placed";

export type CollegePlacementStage =
    | "screening"
    | "ppt"
    | "oa"
    | "interview"
    | "offer"
    | "nothing";

// Off-campus options
export type OffCampusStatus =
    | "applied"
    | "placed"
    | "not-placed";

export type OffCampusStage =
    | "screening"
    | "oa"
    | "interview"
    | "offer";

/**
 * Fields shared by every application.
 * Timestamps will use ISO 8601 strings.
 */
type ApplicationBase = {
    id: string;
    companyName: string;
    role: string;
    createdAt: string;
    updatedAt: string;
};

/**
 * College placement applications.
 * The role type determines which compensation
 * fields apply.
 */
type CollegePlacementBase = ApplicationBase & {
    section: "college-placement";
    status: CollegePlacementStatus | null;
    reachedStage: CollegePlacementStage | null;
};

export type CollegePlacementApplication =
    | (CollegePlacementBase & {
        roleType: "internship";
        stipend: Compensation;
        ctc: null;
    })
    | (CollegePlacementBase & {
        roleType: "full-time";
        stipend: null;
        ctc: Compensation;
    })
    | (CollegePlacementBase & {
        roleType: "internship-plus-full-time";
        stipend: Compensation;
        ctc: Compensation;
    });

/**
 * Off-campus applications.
 */
type OffCampusBase = ApplicationBase & {
    section: "off-campus";
    status: OffCampusStatus | null;
    reachedStage: OffCampusStage | null;
};

export type OffCampusApplication =
    | (OffCampusBase & {
        roleType: "internship";
        stipend: Compensation;
        ctc: null;
    })
    | (OffCampusBase & {
        roleType: "full-time";
        stipend: null;
        ctc: Compensation;
    })
    | (OffCampusBase & {
        roleType: "internship-plus-full-time";
        stipend: Compensation;
        ctc: Compensation;
    });

/**
 * A single type representing an application
 * from either section.
 */
export type Application =
    | CollegePlacementApplication
    | OffCampusApplication;
