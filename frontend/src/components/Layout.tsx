import { NavLink } from "react-router-dom";

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: string }[];
}

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard", icon: "📊" },
      { to: "/work-tray", label: "Safata", icon: "📥" },
    ],
  },
  {
    label: "Gestió",
    items: [
      { to: "/clients", label: "Clients", icon: "👥" },
      { to: "/invoices", label: "Factures", icon: "📄" },
      { to: "/receipts", label: "Impagats", icon: "⚡" },
      { to: "/import", label: "Importació", icon: "🏦" },
    ],
  },
  {
    label: "Administració",
    items: [
      { to: "/settings", label: "Configuració", icon: "⚙️" },
      { to: "/baixes", label: "Baixes", icon: "🚫" },
    ],
  },
];

const uispUrl = window.location.origin;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">Impagats</div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-3">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded mb-0.5 text-sm transition-colors ${
                      isActive
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:bg-slate-700/50"
                    }`
                  }
                >
                  <span className="w-5 text-center text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          <div className="border-t border-slate-700 mt-2 pt-2">
            <a
              href={uispUrl}
              className="flex items-center gap-2.5 px-3 py-2 rounded mb-0.5 text-sm text-slate-400 hover:bg-slate-700/50 transition-colors"
            >
              <span className="w-5 text-center text-sm">📡</span>
              <span>Monitor</span>
            </a>
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
