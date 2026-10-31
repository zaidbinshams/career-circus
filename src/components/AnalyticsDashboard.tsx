import { useState } from "react";

import {
    Award,
    BarChart3,
    Briefcase,
    Building2,
    CalendarDays,
    Coins,
    FileText,
    Send,
    Users,
    type LucideIcon,
} from "lucide-react";

import type {
    Application,
} from "../types/application";

import {
    buildAnalyticsSummary,
    buildCompensationCoverage,
    buildMonthlyActivity,
    buildRoleTypeDistribution,
    buildSectionDistribution,
    buildStageDistribution,
    buildStatusDistribution,
    filterApplicationsByScope,
    type AnalyticsScope,
    type CompensationCoverage,
    type DistributionItem,
} from "../utils/analytics";

import "./AnalyticsDashboard.css";

function MetricCard({
    label,
    value,
    description,
    icon: Icon,
}: {
    label: string;
    value: number;
    description: string;
    icon: LucideIcon;
}) {
    return (
        <article className="analytics-metric-card">
            <div className="analytics-metric-icon">
                <Icon size={19} strokeWidth={1.8} />
            </div>

            <div className="analytics-metric-content">
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{description}</small>
            </div>
        </article>
    );
}

function DistributionCard({
    title,
    description,
    icon: Icon,
    items,
}: {
    title: string;
    description: string;
    icon: LucideIcon;
    items: DistributionItem[];
}) {
    const total = items.reduce(
        (sum, item) => sum + item.count,
        0,
    );

    const maximum = Math.max(
        1,
        ...items.map((item) => item.count),
    );

    return (
        <section className="analytics-card">
            <header className="analytics-card-heading">
                <div className="analytics-card-icon">
                    <Icon size={17} />
                </div>

                <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </header>

            {total === 0 ? (
                <p className="analytics-empty">
                    No applications in this selection yet.
                </p>
            ) : (
                <div
                    className="analytics-distribution-list"
                    role="list"
                    aria-label={title}
                >
                    {items.map((item) => (
                        <div
                            className="analytics-distribution-row"
                            role="listitem"
                            key={item.key}
                        >
                            <div className="analytics-distribution-meta">
                                <span>{item.label}</span>

                                <strong>
                                    {item.count}
                                    <small>
                                        {" "}
                                        ({Math.round(item.percentage)}%)
                                    </small>
                                </strong>
                            </div>

                            <div
                                className="analytics-bar-track"
                                aria-hidden="true"
                            >
                                <div
                                    className="analytics-bar-fill"
                                    style={{
                                        width: `${(item.count / maximum) * 100
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function MonthlyActivityCard({
    applications,
}: {
    applications: Application[];
}) {
    const months = buildMonthlyActivity(applications, new Date(), 6);

    const maximum = Math.max(
        1,
        ...months.map((month) => month.count),
    );

    const hasActivity = months.some(
        (month) => month.count > 0,
    );

    return (
        <section className="analytics-card">
            <header className="analytics-card-heading">
                <div className="analytics-card-icon">
                    <CalendarDays size={17} />
                </div>

                <div>
                    <h2>Application activity</h2>
                    <p>Applications added over the last six months.</p>
                </div>
            </header>

            {!hasActivity ? (
                <p className="analytics-empty">
                    No application activity in this period.
                </p>
            ) : (
                <div
                    className="analytics-month-chart"
                    role="img"
                    aria-label="Number of applications added in each of the last six months"
                >
                    {months.map((month) => (
                        <div
                            className="analytics-month-column"
                            key={month.key}
                        >
                            <strong>{month.count}</strong>

                            <div className="analytics-month-track">
                                <div
                                    className="analytics-month-fill"
                                    style={{
                                        height: `${(month.count / maximum) * 100
                                            }%`,
                                    }}
                                />
                            </div>

                            <span>{month.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function formatCoverage(
    coverage: CompensationCoverage,
): string {
    return [
        `${coverage.fixed} fixed`,
        `${coverage.range} range`,
        `${coverage.tbd} TBD`,
        `${coverage.na} NA`,
    ].join(" · ");
}

function CompensationCoverageCard({
    applications,
}: {
    applications: Application[];
}) {
    const rows = buildCompensationCoverage(applications);

    return (
        <section className="analytics-card analytics-card--wide">
            <header className="analytics-card-heading">
                <div className="analytics-card-icon">
                    <Coins size={17} />
                </div>

                <div>
                    <h2>Compensation data coverage</h2>
                    <p>
                        Monthly stipend and annual CTC records, grouped by
                        currency. Amounts in different currencies are never
                        combined.
                    </p>
                </div>
            </header>

            {rows.length === 0 ? (
                <p className="analytics-empty">
                    Compensation data will appear here once applications
                    have been added.
                </p>
            ) : (
                <div className="analytics-table-scroll">
                    <table className="analytics-coverage-table">
                        <thead>
                            <tr>
                                <th scope="col">Currency</th>
                                <th scope="col">Monthly stipend</th>
                                <th scope="col">Annual CTC</th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.currency}>
                                    <th scope="row">{row.currency}</th>
                                    <td>{formatCoverage(row.stipend)}</td>
                                    <td>{formatCoverage(row.ctc)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="analytics-footnote">
                Fixed amounts, ranges, TBD values, and NA values are
                counted separately. This table describes data coverage,
                not salary averages.
            </p>
        </section>
    );
}

function AnalyticsDashboard({
    applications,
}: {
    applications: Application[];
}) {
    const [scope, setScope] = useState<AnalyticsScope>("all");

    const scopedApplications = filterApplicationsByScope(
        applications,
        scope,
    );

    const summary = buildAnalyticsSummary(scopedApplications);

    const statusDistribution =
        buildStatusDistribution(scopedApplications);

    const stageDistribution =
        buildStageDistribution(scopedApplications);

    const roleDistribution =
        buildRoleTypeDistribution(scopedApplications);

    const sectionDistribution =
        buildSectionDistribution(scopedApplications);

    const scopeLabel =
        scope === "all"
            ? "All applications"
            : scope === "college-placement"
                ? "College Placements"
                : "Off Campus";

    return (
        <div className="analytics-dashboard">
            <div className="analytics-controls">
                <label>
                    <span>Analytics for</span>

                    <select
                        value={scope}
                        onChange={(event) =>
                            setScope(event.target.value as AnalyticsScope)
                        }
                    >
                        <option value="all">All applications</option>
                        <option value="college-placement">
                            College Placements
                        </option>
                        <option value="off-campus">Off Campus</option>
                    </select>
                </label>

                <span className="analytics-scope-count">
                    {scopedApplications.length}{" "}
                    {scopedApplications.length === 1
                        ? "application"
                        : "applications"}
                </span>
            </div>

            <section
                className="analytics-kpi-grid"
                aria-label="Application metrics"
            >
                <MetricCard
                    label="Total applications"
                    value={summary.total}
                    description={scopeLabel}
                    icon={FileText}
                />

                <MetricCard
                    label="Applied"
                    value={summary.applied}
                    description="Current status"
                    icon={Send}
                />

                <MetricCard
                    label="At interview stage"
                    value={summary.interviewStage}
                    description="Current stage"
                    icon={Users}
                />

                <MetricCard
                    label="Offers / placed"
                    value={summary.offersOrPlaced}
                    description="Offer stage or placed status"
                    icon={Award}
                />
            </section>

            <div className="analytics-content-grid">
                <DistributionCard
                    title="Application status"
                    description="Current status of your applications."
                    icon={BarChart3}
                    items={statusDistribution}
                />

                <DistributionCard
                    title="Recruitment stage"
                    description="Highest stage currently recorded."
                    icon={Users}
                    items={stageDistribution}
                />

                <DistributionCard
                    title="Role types"
                    description="How applications are distributed by role."
                    icon={Briefcase}
                    items={roleDistribution}
                />

                <DistributionCard
                    title="Applications by section"
                    description="College placements compared with off-campus applications."
                    icon={Building2}
                    items={sectionDistribution}
                />

                <MonthlyActivityCard
                    applications={scopedApplications}
                />

                <CompensationCoverageCard
                    applications={scopedApplications}
                />
            </div>

            <p className="analytics-data-note">
                Activity is based on the date an application was added.
                Stage and status charts show the latest saved values;
                the app does not currently store historical stage changes.
            </p>
        </div>
    );
}

export default AnalyticsDashboard;