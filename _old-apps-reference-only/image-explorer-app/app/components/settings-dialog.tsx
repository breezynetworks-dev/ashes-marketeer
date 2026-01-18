"use client"

import { useState, useEffect } from "react"
import { Settings, HelpCircle, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface RateLimitTier {
  name: string
  requestsPerMinute: number
  cooldownMs: number
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  free: {
    name: "Free Tier",
    requestsPerMinute: 2,
    cooldownMs: 30000, // 30 seconds between requests (2 per minute)
  },
  tier1: {
    name: "Tier 1",
    requestsPerMinute: 5,
    cooldownMs: 12000, // 12 seconds between requests (5 per minute)
  },
}

export interface NodeInfo {
  name: string
  sheetUrl: string
}

export const NODES: Record<string, NodeInfo> = {
  none: {
    name: "None",
    sheetUrl: "",
  },
  "test-node": {
    name: "Test Node",
    sheetUrl: "https://docs.google.com/spreadsheets/d/13rHCz3GOuPVJgBZJ8Lh2bB4S_QMF9VkdCzvIDg_K0yI/edit?usp=sharing",
  },
  halcyon: {
    name: "Halcyon",
    sheetUrl: "https://docs.google.com/spreadsheets/d/18u_FHqHu67E5JkIhS74Y6UYJqiSndhFR3wO8coPU3tg/edit?usp=sharing",
  },
  joeva: {
    name: "Joeva",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1Ozfp25z0XxlMAdQmhtCutjV38we1vqeL9fTNjp9IMKc/edit?usp=sharing",
  },
  miraleth: {
    name: "Miraleth",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1ple9x10jPrgmZWw_9BvVQzyfnLlDqzlk8b5-rssv9aw/edit?usp=sharing",
  },
  "new-aela": {
    name: "New Aela",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1BBopLtmEpZ8f_XII50e0vGIwuTk8atvhttzFQ87LC3w/edit?usp=sharing",
  },
  winstead: {
    name: "Winstead",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1QrYcjH1X-XVJce2yH_QxZ8uuyTMrCBK5_1tULWd5ynk/edit?usp=sharing",
  },
}

interface SettingsDialogProps {
  selectedTier: string
  onTierChange: (tier: string) => void
  selectedNode: string
  onNodeChange: (node: string) => void
  highAccuracyMode: boolean
  onHighAccuracyModeChange: (enabled: boolean) => void
  shoppingList: string
  onShoppingListChange: (list: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Update the SettingsDialog component to include the help icons
export function SettingsDialog({
  selectedTier,
  onTierChange,
  selectedNode,
  onNodeChange,
  highAccuracyMode,
  onHighAccuracyModeChange = () => {},
  shoppingList = "",
  onShoppingListChange = () => {},
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [tempTier, setTempTier] = useState(selectedTier)
  const [tempNode, setTempNode] = useState(selectedNode)
  const [tempHighAccuracyMode, setTempHighAccuracyMode] = useState(highAccuracyMode ? "enabled" : "disabled")
  const [tempShoppingList, setTempShoppingList] = useState(shoppingList)

  // Sync internal state with external open state
  useEffect(() => {
    if (open !== undefined) {
      setInternalOpen(open)
    }
  }, [open])

  // Handle dialog open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen)
    if (onOpenChange) {
      onOpenChange(newOpen)
    }
  }

  // Reset temp values when dialog opens
  useEffect(() => {
    if (internalOpen) {
      setTempTier(selectedTier)
      setTempNode(selectedNode)
      setTempHighAccuracyMode(highAccuracyMode ? "enabled" : "disabled")
      setTempShoppingList(shoppingList)
    }
  }, [internalOpen, selectedTier, selectedNode, highAccuracyMode, shoppingList])

  const handleSave = () => {
    onTierChange(tempTier)
    onNodeChange(tempNode)
    onHighAccuracyModeChange(tempHighAccuracyMode === "enabled")
    onShoppingListChange(tempShoppingList)
    handleOpenChange(false)
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
      {/* Usage Instructions Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">Usage Instructions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" side="bottom">
          <div className="space-y-2">
            <h4 className="font-medium">Usage Instructions</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                1️⃣ Update the settings (use "tier 1" for rate limits, choose a node (Google Sheet is linked to it) and
                optionally add dev commands.
              </p>
              <p>
                2️⃣ Upload your screenshots (this will automatically batch them in 3 for accuracy and submit them to the
                API within rate limits).
              </p>
              <p>
                3️⃣ The "Process" tab will show items with 5+ gold value, please review and make updates if needed
                (automatically saves changes).
              </p>
              <p>
                4️⃣ When you are happy with the prices, please push the data to Google Sheets and just check it afterwards
                for the next week.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Recent Changes Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Recent Changes</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" side="bottom">
          <div className="space-y-2">
            <h4 className="font-medium">Recent Changes</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>✏️ Added the ability to update prices after the upload is complete.</li>
              <li>🛠️ Added the ability to add developer commands under settings.</li>
              <li>🔍 Added High Accuracy Mode option for processing single images at a time.</li>
            </ul>
          </div>
        </PopoverContent>
      </Popover>

      {/* Settings Dialog */}
      <Dialog open={internalOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure application settings and rate limits.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rate-limit" className="col-span-4">
                API Rate Limits
              </Label>
              <div className="col-span-4">
                <Select value={tempTier} onValueChange={setTempTier}>
                  <SelectTrigger id="rate-limit">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free Tier (2 requests/minute)</SelectItem>
                    <SelectItem value="tier1">Tier 1 (5 requests/minute)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {tempTier === "free" ? "Process up to 2 batches per minute" : "Process up to 5 batches per minute"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="high-accuracy-mode" className="col-span-4">
                High Accuracy Mode
              </Label>
              <div className="col-span-4">
                <Select value={tempHighAccuracyMode} onValueChange={setTempHighAccuracyMode}>
                  <SelectTrigger id="high-accuracy-mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {tempHighAccuracyMode === "enabled"
                    ? "Process 1 image at a time for higher accuracy (slower)"
                    : "Process 3 images at a time (faster but may be less accurate)"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="node-selection" className="col-span-4">
                Node Selection
              </Label>
              <div className="col-span-4">
                <Select value={tempNode} onValueChange={setTempNode}>
                  <SelectTrigger id="node-selection">
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="test-node">Test Node</SelectItem>
                    <SelectItem value="halcyon">Halcyon</SelectItem>
                    <SelectItem value="joeva">Joeva</SelectItem>
                    <SelectItem value="miraleth">Miraleth</SelectItem>
                    <SelectItem value="new-aela">New Aela</SelectItem>
                    <SelectItem value="winstead">Winstead</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Select the node for data collection</p>
                {tempNode && <p className="text-xs text-gray-500 mt-1 truncate">Sheet: {NODES[tempNode].sheetUrl}</p>}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="shopping-list" className="col-span-4">
                My Shopping List
              </Label>
              <div className="col-span-4">
                <Textarea
                  id="shopping-list"
                  value={tempShoppingList}
                  onChange={(e) => setTempShoppingList(e.target.value)}
                  placeholder='Format: "Item name", "rarity"'
                  className="font-mono min-h-[100px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter items to track in format: "Item name", "rarity"
                  <br />
                  Add multiple items by putting each on a new line.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

