"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Upload, LayoutGrid, Settings, Flame, Home } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/market", label: "Market", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col">
      {/* Gradient line at left edge */}
      <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

      <div className="flex-1 glass border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 pb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
              <div className="relative size-11 rounded-xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shadow-lg">
                <Flame className="size-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl leading-tight tracking-tight">Fallen</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Market Intel</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-chart-3 rounded-xl glow-primary-sm" />
                  )}
                  <item.icon className={cn("size-5 relative z-10", isActive && "text-primary-foreground")} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Status indicator at bottom */}
        <div className="p-6 pt-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_2px] shadow-emerald-500/50" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Online</span>
              <span className="text-xs text-muted-foreground">Connected to database</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
