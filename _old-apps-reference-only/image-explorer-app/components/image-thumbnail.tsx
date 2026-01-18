"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageThumbnailProps {
  file: File
  onRemove: () => void
  disabled?: boolean
}

export function ImageThumbnail({ file, onRemove, disabled = false }: ImageThumbnailProps) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    return () => {
      URL.revokeObjectURL(preview || "")
    }
  }, [file, preview])

  if (!preview) {
    return <div className="w-24 h-24 bg-gray-100 rounded-md animate-pulse"></div>
  }

  return (
    <div className="relative group">
      <div className="w-24 h-24 rounded-md overflow-hidden border border-gray-200">
        <img src={preview || "/placeholder.svg"} alt={file.name} className="w-full h-full object-cover" />
      </div>
      {!disabled && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

