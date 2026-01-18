import { NextResponse } from 'next/server'
import { join } from 'path'
import {
  ensureDirectoryExists,
  generateFileHash,
  getTodayUploadDirectory,
  saveFile,
} from '@/lib/file-utils'

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface FileMetadata {
  filename: string
  size: number
  hash: string
  path: string
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Get today's upload directory
    const uploadDir = getTodayUploadDirectory()
    await ensureDirectoryExists(uploadDir)

    const metadata: FileMetadata[] = []

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Invalid file data' },
          { status: 400 }
        )
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.name}. Only PNG and JPEG are allowed.`,
          },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File too large: ${file.name}. Maximum size is 10MB.`,
          },
          { status: 400 }
        )
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Generate hash
      const hash = generateFileHash(buffer)

      // Save file
      const filePath = join(uploadDir, file.name)
      await saveFile(filePath, buffer)

      // Collect metadata
      metadata.push({
        filename: file.name,
        size: file.size,
        hash,
        path: filePath,
      })
    }

    return NextResponse.json({ data: metadata }, { status: 200 })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
