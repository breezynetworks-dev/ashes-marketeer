export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let width = img.width
        let height = img.height

        // Calculate new dimensions if needed
        if (width > maxWidth) {
          const ratio = maxWidth / width
          width = maxWidth
          height = height * ratio
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Could not create blob"))
            }
          },
          file.type,
          quality,
        )
      }
      img.onerror = () => {
        reject(new Error("Could not load image"))
      }
    }
    reader.onerror = () => {
      reject(new Error("Could not read file"))
    }
  })
}

export async function compressImageToBase64(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  const blob = await compressImage(file, maxWidth, quality)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onload = () => {
      const base64 = reader.result?.toString().split(",")[1]
      resolve(base64 || "")
    }
    reader.onerror = reject
  })
}

