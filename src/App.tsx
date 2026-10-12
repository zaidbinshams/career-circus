
import { useState } from "react";
import {
  Award,
  BarChart3,
  Briefcase,
  FileText,
  Grid2X2,
  LayoutDashboard,
  List,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sun,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import type {
  Application,
  ApplicationDraft,
  ApplicationSection,
  Compensation,
  RoleType,
} from "./types/application";

import {
  COLLEGE_PLACEMENT_STAGES,
  COLLEGE_PLACEMENT_STATUSES,
  OFF_CAMPUS_STAGES,
  OFF_CAMPUS_STATUSES,
  ROLE_TYPES,
} from "./utils/applicationValidation";

import { createValidatedApplication } from "./utils/applicationService";
import { sampleApplications } from "./data/sampleApplications";
import { formatCompensation } from "./utils/compensation";
import ApplicationForm from "./components/ApplicationForm";
import "./App.css";

type ThemeMode = "light" | "dark";
type ViewMode = "list" | "grid";

type SortOption =
  | "date-desc"
  | "date-asc"
  | "company-asc"
  | "company-desc"
  | "stipend-asc"
  | "stipend-desc"
  | "ctc-asc"
  | "ctc-desc";

type SectionPreferences = {
  defaultSection: ApplicationSection;
  showCollegePlacements: boolean;
  showOffCampus: boolean;
};

const sections: Record<
  ApplicationSection,
  { label: string; description: string }
> = {
  "college-placement": {
    label: "College Placements",
    description: "Keep track of opportunities through campus placements.",
  },
  "off-campus": {
    label: "Off Campus",
    description: "Keep track of applications submitted independently.",
  },
};

const labels: Record<string, string> = {
  oa: "OA",
  ppt: "PPT",
  "not-eligible": "Not eligible",
  "not-applied": "Not applied",
  "not-placed": "Not placed",
  "full-time": "Full time",
  "internship-plus-full-time": "Internship + full time",
  nothing: "Nothing",
};

const DEFAULT_PREFERENCES: SectionPreferences = {
  defaultSection: "college-placement",
  showCollegePlacements: true,
  showOffCampus: true,
};

function readSavedTheme(): ThemeMode {
  try {
    return localStorage.getItem("career-circus-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function readPreferences(): SectionPreferences {
  try {
    const saved = localStorage.getItem("career-circus-preferences");
    if (!saved) return DEFAULT_PREFERENCES;

    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_PREFERENCES;
    }

    const value = parsed as Partial<SectionPreferences>;

    const showCollegePlacements =
      typeof value.showCollegePlacements === "boolean"
        ? value.showCollegePlacements
        : true;

    const showOffCampus =
      typeof value.showOffCampus === "boolean"
        ? value.showOffCampus
        : true;

    if (!showCollegePlacements && !showOffCampus) {
      return DEFAULT_PREFERENCES;
    }

    let defaultSection: ApplicationSection;

    if (value.defaultSection === "off-campus" && showOffCampus) {
      defaultSection = "off-campus";
    } else if (showCollegePlacements) {
      defaultSection = "college-placement";
    } else {
      defaultSection = "off-campus";
    }

    return {
      defaultSection,
      showCollegePlacements,
      showOffCampus,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: SectionPreferences) {
  try {
    localStorage.setItem(
      "career-circus-preferences",
      JSON.stringify(preferences),
    );
  } catch {
    // Preferences remain usable during the current session.
  }
}

function formatLabel(value: string | null): string {
  if (value === null) return "Not set";
  if (labels[value]) return labels[value];

  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function amountForSort(value: Compensation | null): number | null {
  if (value === null || value.kind === "tbd") return null;
  if (value.kind === "fixed") return value.amount;
  return value.min;
}

function compareCompensation(
  a: Compensation | null,
  b: Compensation | null,
  descending: boolean,
): number {
  const first = amountForSort(a);
  const second = amountForSort(b);

  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;

  return descending ? second - first : first - second;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div className="metric-content">
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function CompanyCell({ application }: { application: Application }) {
  return (
    <div className="company-cell">
      <span className="company-name">{application.companyName}</span>
      <span className="role-name">{application.role}</span>
    </div>
  );
}

function ApplicationCard({ application }: { application: Application }) {
  return (
    <article className="application-card">
      <div className="application-card-heading">
        <div>
          <h3>{application.companyName}</h3>
          <p className="role-name">{application.role}</p>
        </div>
        <time className="added-date" dateTime={application.createdAt}>
          {formatDate(application.createdAt)}
        </time>
      </div>

      <div className="card-tags">
        <span className="type-pill">{formatLabel(application.roleType)}</span>
        <span className={`status-pill status-pill--${application.status ?? "unset"}`}>
          {formatLabel(application.status)}
        </span>
        <span className="stage-pill">
          {formatLabel(application.reachedStage)}
        </span>
      </div>

      <div className="card-compensation">
        <div>
          <span>Stipend</span>
          <strong>
            {formatCompensation(application.stipend, "stipend", application.currency)}
          </strong>
        </div>
        <div>
          <span>CTC</span>
          <strong>
            {formatCompensation(application.ctc, "ctc", application.currency)}
          </strong>
        </div>
      </div>
    </article>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(readSavedTheme);
  const [preferences, setPreferences] =
    useState<SectionPreferences>(readPreferences);
  const [applications, setApplications] =
    useState<Application[]>(sampleApplications);

  const [activeSection, setActiveSection] =
    useState<ApplicationSection>(() => preferences.defaultSection);

  const [showPreferences, setShowPreferences] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<RoleType | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortBy, setSortBy] =
    useState<SortOption>("date-desc");
  const [view, setView] = useState<ViewMode>("list");

  const visibleSections: ApplicationSection[] = [
    ...(preferences.showCollegePlacements
      ? (["college-placement"] as const)
      : []),
    ...(preferences.showOffCampus ? (["off-campus"] as const) : []),
  ];

  const sectionApplications = applications.filter(
    (application) => application.section === activeSection,
  );

  const statusOptions =
    activeSection === "college-placement"
      ? COLLEGE_PLACEMENT_STATUSES
      : OFF_CAMPUS_STATUSES;

  const stageOptions =
    activeSection === "college-placement"
      ? COLLEGE_PLACEMENT_STAGES
      : OFF_CAMPUS_STAGES;

  const query = search.trim().toLocaleLowerCase();

  const filteredApplications = sectionApplications
    .filter((application) => {
      const matchesSearch =
        application.companyName.toLocaleLowerCase().includes(query) ||
        application.role.toLocaleLowerCase().includes(query);

      return (
        matchesSearch &&
        (roleFilter === "all" || application.roleType === roleFilter) &&
        (statusFilter === "all" || application.status === statusFilter) &&
        (stageFilter === "all" || application.reachedStage === stageFilter)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return Date.parse(a.createdAt) - Date.parse(b.createdAt);
        case "date-desc":
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        case "company-asc":
          return a.companyName.localeCompare(b.companyName, "en-US");
        case "company-desc":
          return b.companyName.localeCompare(a.companyName, "en-US");
        case "stipend-asc":
          return compareCompensation(a.stipend, b.stipend, false);
        case "stipend-desc":
          return compareCompensation(a.stipend, b.stipend, true);
        case "ctc-asc":
          return compareCompensation(a.ctc, b.ctc, false);
        case "ctc-desc":
          return compareCompensation(a.ctc, b.ctc, true);
        default:
          return 0;
      }
    });

  // These overview metrics are provisional and will be revisited.
  const metrics = [
    {
      label: "Total applications",
      value: sectionApplications.length,
      icon: FileText,
    },
    {
      label: "Applied",
      value: sectionApplications.filter((app) => app.status === "applied").length,
      icon: Send,
    },
    {
      label: "Interviews",
      value: sectionApplications.filter((app) => app.reachedStage === "interview").length,
      icon: Users,
    },
    {
      label: "Offers",
      value: sectionApplications.filter(
        (app) => app.status === "placed" || app.reachedStage === "offer",
      ).length,
      icon: Award,
    },
  ];

  const hasActiveFilters =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    stageFilter !== "all";

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);

    try {
      localStorage.setItem("career-circus-theme", nextTheme);
    } catch {
      // The theme remains usable during this session.
    }
  }

  function changeSection(section: ApplicationSection) {
    setActiveSection(section);
    setRoleFilter("all");
    setStatusFilter("all");
    setStageFilter("all");
  }

  function updateSectionVisibility(
    section: ApplicationSection,
    visible: boolean,
  ) {
    const next: SectionPreferences = {
      ...preferences,
      showCollegePlacements:
        section === "college-placement"
          ? visible
          : preferences.showCollegePlacements,
      showOffCampus:
        section === "off-campus"
          ? visible
          : preferences.showOffCampus,
    };

    if (!next.showCollegePlacements && !next.showOffCampus) return;

    if (
      next.defaultSection === "college-placement" &&
      !next.showCollegePlacements
    ) {
      next.defaultSection = "off-campus";
    } else if (
      next.defaultSection === "off-campus" &&
      !next.showOffCampus
    ) {
      next.defaultSection = "college-placement";
    }

    setPreferences(next);
    savePreferences(next);

    if (section === activeSection && !visible) {
      const fallbackSection =
        section === "college-placement" ? "off-campus" : "college-placement";

      setActiveSection(fallbackSection);
      setRoleFilter("all");
      setStatusFilter("all");
      setStageFilter("all");
    }
  }

  function updateDefaultSection(section: ApplicationSection) {
    if (!visibleSections.includes(section)) return;

    const next = { ...preferences, defaultSection: section };
    setPreferences(next);
    savePreferences(next);
  }

  function handleCreateApplication(draft: ApplicationDraft): string[] | void {
    const result = createValidatedApplication(draft);

    if (!result.success) {
      return result.errors;
    }

    setApplications((current) => [...current, result.application]);
    setActiveSection(result.application.section);
    setRoleFilter("all");
    setStatusFilter("all");
    setStageFilter("all");
    setSearch("");
    setShowApplicationForm(false);

    return;
  }

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setStageFilter("all");
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="sidebar">
        <a className="brand" href="#main-content" aria-label="Career Circus home">
          <span className="wordmark">career circus</span>
        </a>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${!showPreferences ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setShowPreferences(false)}
          >
            <LayoutDashboard size={18} />
            <span>Applications</span>
          </button>

          <button
            className="nav-item nav-item--disabled"
            type="button"
            disabled
            title="Analytics will be added later"
          >
            <BarChart3 size={18} />
            <span>Analytics</span>
          </button>

          <button
            className="nav-item nav-item--disabled"
            type="button"
            disabled
            title="Excel import will be added later"
          >
            <Upload size={18} />
            <span>Import</span>
          </button>

          <button
            className={`nav-item ${showPreferences ? "nav-item--active" : ""}`}
            type="button"
            aria-expanded={showPreferences}
            onClick={() => setShowPreferences((current) => !current)}
          >
            <Settings size={18} />
            <span>Preferences</span>
          </button>
        </nav>

        {showPreferences && (
          <section className="preferences-popover" role="dialog" aria-label="Dashboard preferences">
            <div className="preferences-heading">
              <div>
                <h2>Preferences</h2>
                <p>Choose which sections appear on your dashboard.</p>
              </div>
              <button
                type="button"
                className="preferences-close"
                onClick={() => setShowPreferences(false)}
                aria-label="Close preferences"
              >
                <X size={17} />
              </button>
            </div>

            <label className="preference-option">
              <input
                type="checkbox"
                checked={preferences.showCollegePlacements}
                disabled={!preferences.showOffCampus}
                onChange={(event) =>
                  updateSectionVisibility("college-placement", event.target.checked)
                }
              />
              <span>Show College Placements</span>
            </label>

            <label className="preference-option">
              <input
                type="checkbox"
                checked={preferences.showOffCampus}
                disabled={!preferences.showCollegePlacements}
                onChange={(event) =>
                  updateSectionVisibility("off-campus", event.target.checked)
                }
              />
              <span>Show Off Campus</span>
            </label>

            <label className="default-section-field">
              <span>Default section on launch</span>
              <select
                value={preferences.defaultSection}
                onChange={(event) =>
                  updateDefaultSection(event.target.value as ApplicationSection)
                }
              >
                {visibleSections.map((section) => (
                  <option key={section} value={section}>
                    {sections[section].label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
      </header>

      <main className="main-area" id="main-content">
        <header className="page-heading">
          <div>
            <p className="eyebrow">YOUR DASHBOARD</p>
            <h1>Applications</h1>
            <p className="page-description">
              Keep track of your opportunities and their progress.
            </p>
          </div>

          <div className="page-actions">
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              <Sun size={16} />
              <span className="theme-switch-track" aria-hidden="true">
                <span
                  className={`theme-switch-thumb ${theme === "dark" ? "theme-switch-thumb--dark" : ""
                    }`}
                />
              </span>
              <Moon size={16} />
            </button>

            <button
              className="button button--primary"
              type="button"
              onClick={() => setShowApplicationForm(true)}
            >
              <Plus size={17} />
              <span>Add application</span>
            </button>
          </div>
        </header>

        <nav className="section-tabs" aria-label="Application sections">
          {visibleSections.map((section) => (
            <button
              key={section}
              type="button"
              className={`section-tab ${activeSection === section ? "section-tab--active" : ""
                }`}
              aria-pressed={activeSection === section}
              onClick={() => changeSection(section)}
            >
              {sections[section].label}
            </button>
          ))}
        </nav>

        <section className="metrics-grid" aria-label="Application summary">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <section className="applications-panel">
          <div className="panel-heading">
            <div>
              <h2>{sections[activeSection].label}</h2>
              <p>{sections[activeSection].description}</p>
            </div>
            <span className="record-count">
              {filteredApplications.length}{" "}
              {filteredApplications.length === 1 ? "application" : "applications"}
            </span>
          </div>

          <div className="toolbar">
            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search companies or roles</span>
              <input
                type="search"
                placeholder="Search companies or roles..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="select-field">
              <span className="sr-only">Filter by role type</span>
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as RoleType | "all")
                }
              >
                <option value="all">All role types</option>
                {ROLE_TYPES.map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {formatLabel(roleType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field">
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field">
              <span className="sr-only">Filter by stage</span>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="all">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatLabel(stage)}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field sort-field">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span className="sr-only">Sort applications</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                <option value="date-desc">Newest added</option>
                <option value="date-asc">Oldest added</option>
                <option value="company-asc">Company A–Z</option>
                <option value="company-desc">Company Z–A</option>
                <option value="stipend-asc">Stipend: low to high</option>
                <option value="stipend-desc">Stipend: high to low</option>
                <option value="ctc-asc">CTC: low to high</option>
                <option value="ctc-desc">CTC: high to low</option>
              </select>
            </label>

            <div className="view-switch" aria-label="Application view">
              <button
                type="button"
                className={`view-button ${view === "list" ? "view-button--active" : ""}`}
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={17} />
              </button>
              <button
                type="button"
                className={`view-button ${view === "grid" ? "view-button--active" : ""}`}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Grid2X2 size={16} />
              </button>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="filter-summary">
              <span>
                Showing {filteredApplications.length} of {sectionApplications.length} applications
              </span>
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          )}

          {filteredApplications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Briefcase size={25} strokeWidth={1.6} />
              </div>
              <h3>
                {sectionApplications.length === 0
                  ? "No applications yet"
                  : "No matching applications"}
              </h3>
              <p>
                {sectionApplications.length === 0
                  ? "Applications you add will appear here."
                  : "Try changing your search or filters."}
              </p>
              {hasActiveFilters && (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : view === "list" ? (
            <div className="table-scroll">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th scope="col">Company / Role</th>
                    <th scope="col">Role type</th>
                    <th scope="col">Stipend</th>
                    <th scope="col">CTC</th>
                    <th scope="col">Status</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => (
                    <tr key={application.id}>
                      <td><CompanyCell application={application} /></td>
                      <td>
                        <span className="type-pill">
                          {formatLabel(application.roleType)}
                        </span>
                      </td>
                      <td className="compensation-cell">
                        {formatCompensation(application.stipend, "stipend", application.currency)}
                      </td>
                      <td className="compensation-cell">
                        {formatCompensation(application.ctc, "ctc", application.currency)}
                      </td>
                      <td>
                        <span className={`status-pill status-pill--${application.status ?? "unset"}`}>
                          {formatLabel(application.status)}
                        </span>
                      </td>
                      <td>
                        <span className="stage-pill">
                          {formatLabel(application.reachedStage)}
                        </span>
                      </td>
                      <td>
                        <time className="added-date" dateTime={application.createdAt}>
                          {formatDate(application.createdAt)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="application-grid">
              {filteredApplications.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </div>
          )}

          <footer className="panel-footer">
            <span>Sample records for development</span>
            <span>Changes reset when this page is refreshed</span>
          </footer>
        </section>
      </main>

      {showApplicationForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowApplicationForm(false);
            }
          }}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Add application"
          >
            <ApplicationForm
              initialSection={activeSection}
              availableSections={visibleSections}
              onSubmit={handleCreateApplication}
              onCancel={() => setShowApplicationForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
