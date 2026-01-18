import { CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PushResultProps {
  result: {
    success: boolean
    message?: string
    error?: string
    sheetOpenUrl?: string
  } | null
}

export function PushResult({ result }: PushResultProps) {
  if (!result) return null

  return (
    <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
      <div className="flex items-start">
        <div className="mr-2 mt-0.5">
          {result.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <AlertDescription className="mb-2">
            {result.success ? result.message : `Error: ${result.error}`}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}

