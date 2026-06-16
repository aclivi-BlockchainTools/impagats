import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/invoices", label: "Factures" },
  { to: "/import", label: "Importació bancària" },
  { to: "/receipts", label: "Impagats" },
  { to: "/work-tray", label: "Safata" },
  { to: "/settings", label: "Configuració" },
];

const uispUrl = window.location.origin;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">Impagats</div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded mb-1 text-sm ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href={uispUrl}
            className="block px-3 py-2 rounded mb-1 text-sm text-slate-300 hover:bg-slate-700"
          >
            Monitor
          </a>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
