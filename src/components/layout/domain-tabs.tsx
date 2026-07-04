import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface DomainTab {
  to: string;
  labelKey: string;
  /** Use `end` for the index tab so it isn't active on child routes. */
  end?: boolean;
}

/**
 * Layout that renders a horizontal tab bar for a domain and an <Outlet/> for
 * the active sub-page. Tabs are route-driven so deep links and back/forward
 * keep working.
 */
export function DomainTabs({ tabs }: { tabs: DomainTab[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-0.5 border-b border-border">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "relative -mb-px rounded-t-md px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
