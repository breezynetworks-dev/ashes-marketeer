"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, AlertCircle, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function RecipeUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      handleFile(droppedFile)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    if (!file.type.match("image.*")) {
      alert("Please select an image file")
      return
    }

    setFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearFile = () => {
    setFile(null)
    setPreviewUrl(null)
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-amber-500">Recipe Upload</CardTitle>
        <CardDescription className="text-gray-300">
          Upload a screenshot of a recipe to see required materials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 bg-amber-900/30 border-amber-800/50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-gray-200">
            This feature is coming soon! The UI is ready, but the backend processing is not yet implemented.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center
                transition-colors cursor-pointer min-h-[250px]
                ${isDragging ? "border-amber-500 bg-amber-500/10" : "border-gray-600 hover:border-gray-500"}
                ${file ? "bg-gray-700/50" : ""}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("recipe-upload")?.click()}
            >
              {!file ? (
                <>
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-300 text-center mb-1">
                    Drag and drop a recipe screenshot here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400 text-center">Supports PNG, JPG, or JPEG</p>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  {previewUrl && (
                    <div className="relative mb-2">
                      <img
                        src={previewUrl || "/placeholder.svg"}
                        alt="Recipe preview"
                        className="max-h-[180px] rounded-md object-contain"
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-300 mb-2">{file.name}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearFile()
                    }}
                    className="text-xs text-gray-200 border-gray-600"
                  >
                    Remove
                  </Button>
                </div>
              )}
              <input
                type="file"
                id="recipe-upload"
                className="hidden"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileInput}
              />
            </div>

            <div className="mt-4">
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={!file}>
                <Upload className="mr-2 h-4 w-4" />
                Process Recipe
              </Button>
            </div>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 min-h-[250px] flex flex-col">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Recipe Requirements</h3>

            {!file ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <p className="text-center">Upload a recipe screenshot to see the required materials</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <p className="text-sm text-gray-300 mb-4">Recipe analysis in progress...</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-center text-gray-400 italic">This feature is not yet implemented</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <Button variant="outline" className="w-full text-gray-200 border-gray-600" disabled>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Transfer to Bulk Search
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

