"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { BarChart3, LayoutGrid, Settings, Upload, ScrollText, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_VERSION } from "@/lib/version"
import type { UserRole } from "@/lib/auth"

type NavItem = {
  href: string
  label: string
  icon: typeof Upload
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: "/upload", label: "Upload", icon: Upload, roles: ["uploader", "admin"] },
  { href: "/", label: "Market", icon: LayoutGrid, roles: ["browser", "admin"] },
  { href: "/statistics", label: "Statistics", icon: BarChart3, roles: ["admin"] },
]

const bottomNavItems: NavItem[] = [
  { href: "/changelog", label: "Updates", icon: ScrollText, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
]

export function Nav() {
  const pathname = usePathname()
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRole() {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setRole(data.role)
        }
      } catch (error) {
        console.error('Failed to fetch role:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRole()
  }, [])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/market"
    return pathname === href || pathname.startsWith(href + "/")
  }

  const canAccess = (item: NavItem) => {
    if (!role) return false
    return item.roles.includes(role)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors, still redirect to login
    }
    window.location.href = '/login'
  }

  // Don't render nav on login page
  if (pathname === '/login') {
    return null
  }

  const visibleNavItems = navItems.filter(canAccess)
  const visibleBottomItems = bottomNavItems.filter(canAccess)

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col">

      <div className="flex-1 glass border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 pb-8">
          <Link href={role === 'uploader' ? '/upload' : '/'} className="flex items-center gap-3 group">
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
            {isLoading ? (
              // Loading skeleton
              <>
                <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
              </>
            ) : (
              visibleNavItems.map((item) => {
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
              })
            )}
          </div>
        </nav>

        {/* Bottom section: Changelog, Settings, Logout */}
        <div className="p-6 pt-4 border-t border-white/5 space-y-1">
          {!isLoading && visibleBottomItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                pathname === item.href
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {pathname === item.href && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-chart-3 rounded-xl glow-primary-sm" />
              )}
              <item.icon className={cn("size-5 relative z-10", pathname === item.href && "text-primary-foreground")} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}

          {/* Logout button */}
          {!isLoading && role && (
            <button
              onClick={handleLogout}
              className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-white/5 w-full"
            >
              <LogOut className="size-5" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
