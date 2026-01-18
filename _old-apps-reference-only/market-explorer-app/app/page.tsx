"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataLoader from "@/components/data-loader"
import ManualSearch from "@/components/manual-search"
import BulkSearch from "@/components/bulk-search"
import MarketSniper from "@/components/market-sniper"
import RecipeUpload from "@/components/recipe-upload"
import { MarketDataProvider } from "@/components/market-data-provider"

export default function Home() {
  const [activeTab, setActiveTab] = useState("manual-search")

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950 py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-amber-500">The Night Shift: Market Explorer</h1>
          <p className="mt-2 text-gray-400">Commerce rests for no man (or Olives)</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-grow">
        <MarketDataProvider>
          <DataLoader />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger
                value="manual-search"
                className="data-[state=active]:bg-gray-700 text-gray-200 data-[state=active]:text-white font-medium"
              >
                Manual Search
              </TabsTrigger>
              <TabsTrigger
                value="bulk-search"
                className="data-[state=active]:bg-gray-700 text-gray-200 data-[state=active]:text-white font-medium"
              >
                Bulk Search
              </TabsTrigger>
              <TabsTrigger
                value="market-sniper"
                className="data-[state=active]:bg-gray-700 text-gray-200 data-[state=active]:text-white font-medium"
              >
                Market Sniper
              </TabsTrigger>
              <TabsTrigger
                value="recipe-upload"
                className="data-[state=active]:bg-gray-700 text-gray-200 data-[state=active]:text-white font-medium"
              >
                Recipe Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual-search" className="mt-6">
              <ManualSearch />
            </TabsContent>

            <TabsContent value="bulk-search" className="mt-6">
              <BulkSearch />
            </TabsContent>

            <TabsContent value="market-sniper" className="mt-6">
              <MarketSniper />
            </TabsContent>

            <TabsContent value="recipe-upload" className="mt-6">
              <RecipeUpload />
            </TabsContent>
          </Tabs>
        </MarketDataProvider>
      </main>

      <footer className="border-t border-gray-800 bg-gray-950 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>© {new Date().getFullYear()} The Night Shift Guild Market Explorer</p>
        </div>
      </footer>
    </div>
  )
}

