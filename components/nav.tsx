"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { BarChart3, LayoutGrid, Settings, Upload, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_VERSION } from "@/lib/version"

const navItems = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/", label: "Market", icon: LayoutGrid },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
]

export function Nav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/market"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col">

      <div className="flex-1 glass border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 pb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
              <div className="relative size-11 rounded-xl overflow-hidden shadow-lg">
                <Image
                  src="/logo.png"
                  alt="Fallen Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl leading-tight tracking-tight">Fallen</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Market Intel</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/70">v{APP_VERSION}</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {active && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-chart-3 rounded-xl glow-primary-sm" />
                  )}
                  <item.icon className={cn("size-5 relative z-10", active && "text-primary-foreground")} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Changelog & Settings at bottom */}
        <div className="p-6 pt-4 border-t border-white/5 space-y-1">
          <Link
            href="/changelog"
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              pathname === "/changelog"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {pathname === "/changelog" && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-chart-3 rounded-xl glow-primary-sm" />
            )}
            <ScrollText className={cn("size-5 relative z-10", pathname === "/changelog" && "text-primary-foreground")} />
            <span className="relative z-10">Updates</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              pathname === "/settings"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {pathname === "/settings" && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-chart-3 rounded-xl glow-primary-sm" />
            )}
            <Settings className={cn("size-5 relative z-10", pathname === "/settings" && "text-primary-foreground")} />
            <span className="relative z-10">Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}
