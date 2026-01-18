"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Settings } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

// Remove the model field from the ExtractionSettings interface
interface ExtractionSettings {
  batchSize: number
  systemPrompt: string
  includeHeaders: boolean
}

interface ExtractionSettingsProps {
  settings: ExtractionSettings
  onSettingsChange: (settings: ExtractionSettings) => void
  disabled?: boolean
}

const DEFAULT_SYSTEM_PROMPT = `Your job is to extract data from screenshots and to figure out missing currency (either gold, silver or copper, although it's usually gold) and add a "0".

Please remember to always do the second part, sometimes not all the data will be in the screenshot and it's critical that you add 0 for missing currencies.

Please extract the store name, the items listed, the quantity, the rarity, and the price (gold, silver and copper, although not all of these will be in the screenshots, take a look at how to figure it out below).

1. To determine the gold, look at the number to the left of the gold coin (if there is no gold coin, always enter "0" for gold for the item).

2. To determine the silver, look at the number to the left of the silver coin (if there is no silver coin, always enter "0" for silver for the item).

3. To determine the copper, look at the number to the left of the copper coin (if there is no copper coin, always enter "0" for copper for the item).

Please make absolutely sure to not enter silver prices inside of the gold column, this is a recurring mistake that you keep making and it is breaking my system. If you see more than 10 for gold, rescan and make sure that you are not making a mistake.

Do not use x before the number (just need the number for the quantity, not the x)

Output only the CSV content — no explanations or headings.`

// Update the component to remove the model field
export function ExtractionSettings({ settings, onSettingsChange, disabled = false }: ExtractionSettingsProps) {
  const [localSettings, setLocalSettings] = useState<ExtractionSettings>(settings)
  const [open, setOpen] = useState(false)

  const handleChange = (field: keyof ExtractionSettings, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    onSettingsChange(localSettings)
    setOpen(false)
  }

  const handleReset = () => {
    setLocalSettings({
      ...settings,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Extraction Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="batchSize" className="text-right">
              Batch Size
            </Label>
            <Input
              id="batchSize"
              type="number"
              min="1"
              max="20"
              value={localSettings.batchSize}
              onChange={(e) => handleChange("batchSize", Number.parseInt(e.target.value) || 10)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="systemPrompt" className="text-right pt-2">
              System Prompt
            </Label>
            <div className="col-span-3 space-y-2">
              <Textarea
                id="systemPrompt"
                value={localSettings.systemPrompt}
                onChange={(e) => handleChange("systemPrompt", e.target.value)}
                className="min-h-[200px]"
              />
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset to Default
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includeHeaders" className="text-right">
              Include Headers
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeHeaders"
                checked={localSettings.includeHeaders}
                onCheckedChange={(checked) => handleChange("includeHeaders", !!checked)}
              />
              <Label htmlFor="includeHeaders">Add column headers to CSV</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

