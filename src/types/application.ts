
export const CURRENCY_CODES = [
    "INR",
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "SGD",
    "AED",
    "JPY",
    "CNY",
    "CHF",
    "NZD",
    "HKD",
    "SAR",
    "MYR",
    "IDR",
    "KRW",
    "THB",
    "PHP",
    "BDT",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type ApplicationSection =
    | "college-placement"
    | "off-campus";

export type RoleType =
    | "internship"
    | "full-time"
    | "internship-plus-full-time";

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

export type OffCampusStatus =
    | "applied"
    | "placed"
    | "not-placed";

export type OffCampusStage =
    | "screening"
    | "oa"
    | "interview"
    | "offer";

type ApplicationBase = {
    id: string;
    companyName: string;
    role: string;
    currency: CurrencyCode;
    createdAt: string;
};

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

export type Application =
    | CollegePlacementApplication
    | OffCampusApplication;

type WithoutSystemFields<T> = T extends Application
    ? Omit<T, "id" | "createdAt">
    : never;

export type ApplicationDraft =
    WithoutSystemFields<Application>;
