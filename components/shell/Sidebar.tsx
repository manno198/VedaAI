import {
  IconAssignments,
  IconClassroom,
  IconExams,
  IconExpand,
  IconHome,
  IconLibrary,
  IconSettings,
  IconSparkle,
} from "@/components/icons";

const NAV_ITEMS = [
  { label: "Home", icon: IconHome },
  { label: "My Classroom", icon: IconClassroom },
  { label: "Assignments", icon: IconAssignments },
  { label: "Exams", icon: IconExams, active: true },
  { label: "My Library", icon: IconLibrary },
];

export function Sidebar({ expanded }: { expanded: boolean }) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col justify-between bg-ink py-4 text-white transition-[width] duration-200 lg:flex ${
        expanded ? "w-60 px-4" : "w-16 items-center px-2"
      }`}
    >
      <div className={`flex flex-col ${expanded ? "gap-5" : "items-center gap-5"}`}>
        <div className={`flex items-center gap-2 ${expanded ? "" : "justify-center"}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-sm font-black text-ink">
            V
          </span>
          {expanded && <span className="text-sm font-bold tracking-tight">VedaAI</span>}
          {expanded && (
            <button
              type="button"
              className="ml-auto rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Collapse sidebar"
            >
              <IconExpand className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border border-accent/40 bg-ink-soft py-2 text-xs font-semibold text-white ${
            expanded ? "justify-center px-3" : "h-9 w-9 justify-center"
          }`}
        >
          <IconSparkle className="h-3.5 w-3.5 shrink-0 text-accent" />
          {expanded && <span className="whitespace-nowrap">AI Teacher&apos;s Toolkit</span>}
        </div>

        <nav className={`flex flex-col gap-1 ${expanded ? "" : "items-center"}`}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              onClick={(e) => e.preventDefault()}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
                expanded ? "px-3 py-2" : "h-9 w-9 justify-center"
              } ${
                item.active
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {expanded && <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </div>

      <div className={`flex flex-col gap-3 ${expanded ? "" : "items-center"}`}>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          title="Settings"
          className={`flex items-center gap-2.5 rounded-lg text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white/80 ${
            expanded ? "px-3 py-2" : "h-9 w-9 justify-center"
          }`}
        >
          <IconSettings className="h-4 w-4 shrink-0" />
          {expanded && <span>Settings</span>}
        </a>

        {expanded ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-soft px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-white">
              DP
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">Delhi Public School</p>
              <p className="truncate text-[11px] text-white/40">Bokaro Steel City</p>
            </div>
          </div>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
            DP
          </span>
        )}
      </div>
    </aside>
  );
}
