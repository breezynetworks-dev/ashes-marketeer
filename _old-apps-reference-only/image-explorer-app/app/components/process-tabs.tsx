"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CSVRow } from "./data-table"
import { FilteredReviewTable } from "./filtered-review-table"

interface ProcessTabsProps {
  data: CSVRow[]
  onDataChange: (newData: CSVRow[]) => void
  isPushing: boolean
  isProcessing: boolean
  onPushToSheets: () => void
  shoppingList?: string
}

export function ProcessTabs({
  data,
  onDataChange,
  isPushing,
  isProcessing,
  onPushToSheets,
  shoppingList = "",
}: ProcessTabsProps) {
  const [activeSubTab, setActiveSubTab] = useState("4-gold-or-more")

  // Check if shopping list has content
  const hasShoppingList = shoppingList.trim() !== ""

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className={`grid ${hasShoppingList ? "grid-cols-6" : "grid-cols-5"}`}>
          <TabsTrigger value="4-gold-or-more">4 Gold Or More</TabsTrigger>
          <TabsTrigger value="low-rarity-high-price">-Rarity, +Price</TabsTrigger>
          <TabsTrigger value="high-rarity-low-price">+Rarity, -Price</TabsTrigger>
          <TabsTrigger value="epic-rarity-all">Epic Rarities</TabsTrigger>
          <TabsTrigger value="legendary-rarity-all">Legendaries</TabsTrigger>
          {hasShoppingList && <TabsTrigger value="shopping-list">Shopping List</TabsTrigger>}
        </TabsList>

        <TabsContent value="4-gold-or-more" className="border rounded-md p-2 mt-2">
          <FilteredReviewTable data={data} onDataChange={onDataChange} filterType="worth-4-gold-or-more" />
        </TabsContent>

        <TabsContent value="low-rarity-high-price" className="border rounded-md p-2 mt-2">
          <FilteredReviewTable data={data} onDataChange={onDataChange} filterType="low-rarity-high-price" />
        </TabsContent>

        <TabsContent value="high-rarity-low-price" className="border rounded-md p-2 mt-2">
          <FilteredReviewTable data={data} onDataChange={onDataChange} filterType="high-rarity-low-price" />
        </TabsContent>

        <TabsContent value="epic-rarity-all" className="border rounded-md p-2 mt-2">
          <FilteredReviewTable data={data} onDataChange={onDataChange} filterType="epic-rarity-all" />
        </TabsContent>

        <TabsContent value="legendary-rarity-all" className="border rounded-md p-2 mt-2">
          <FilteredReviewTable data={data} onDataChange={onDataChange} filterType="legendary-rarity-all" />
        </TabsContent>

        {hasShoppingList && (
          <TabsContent value="shopping-list" className="border rounded-md p-2 mt-2">
            <FilteredReviewTable
              data={data}
              onDataChange={onDataChange}
              filterType="shopping-list"
              shoppingList={shoppingList}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

