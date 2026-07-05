import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Smartphone,
  Archive,
  ArrowLeftRight,
  Database,
  FileText,
  ShieldAlert,
  Briefcase,
  Settings,
  ShieldCheck,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; icon: LucideIcon; key: string; end?: boolean };

const NAV: Item[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/devices", icon: Smartphone, key: "devices" },
  { to: "/backups", icon: Archive, key: "backups" },
  { to: "/transfer", icon: ArrowLeftRight, key: "transfer" },
  { to: "/export", icon: Database, key: "dataExport" },
  { to: "/reports", icon: FileText, key: "reports" },
  { to: "/security", icon: ShieldAlert, key: "security" },
  { to: "/business", icon: Briefcase, key: "business" },
];

function NavItem({ item, label }: { item: Item; label: string }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent/90 text-white"
            : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();

  const labelFor = (key: string) => {
    // Domain-level labels come from navGroups; simple items from nav.
    const groupKeys: Record<string, string> = {
      backups: "navGroups.backups",
      transfer: "navGroups.transfer",
      dataExport: "navGroups.dataExport",
      reports: "navGroups.reports",
      security: "navGroups.security",
      business: "navGroups.business",
    };
    return groupKeys[key] ? t(groupKeys[key]) : t(`nav.${key}`);
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 h-14 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t("app.name")}</p>
          <p className="text-[10px] text-sidebar-foreground/60">
            {t("app.subtitle")}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavItem key={item.to} item={item} label={labelFor(item.key)} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/5 px-3 py-3">
        <NavItem
          item={{ to: "/privacy", icon: ShieldCheck, key: "privacyCenter" }}
          label={t("nav.privacyCenter")}
        />
        <NavItem
          item={{ to: "/settings", icon: Settings, key: "settings", end: true }}
          label={t("nav.settings")}
        />
        <NavItem
          item={{ to: "/about", icon: Info, key: "about", end: true }}
          label={t("nav.about")}
        />
      </div>
    </aside>
  );
}
