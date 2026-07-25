"use client"

import * as React from "react"
import {
  Download01Icon,
  MinusSignCircleIcon,
  MoreHorizontalIcon,
  PlusSignCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const ZOOM_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type DocxViewerProps = {
  className?: string
  fileName?: string
  showDownload?: boolean
  showToolbar?: boolean
  src?: string
  buffer?: ArrayBuffer | null
  toolbarActions?: React.ReactNode
}

function ToolbarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function ensureDocxExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".docx")
    ? fileName
    : `${fileName}.docx`
}

function getDocxDownloadFileName(
  fileName: string | undefined,
  src: string | undefined
) {
  if (fileName?.trim()) return ensureDocxExtension(fileName.trim())

  if (src) {
    const pathname = src.split(/[?#]/)[0] ?? ""
    const rawName = pathname.split("/").pop()

    if (rawName) {
      try {
        return ensureDocxExtension(decodeURIComponent(rawName))
      } catch {
        return ensureDocxExtension(rawName)
      }
    }
  }

  return "document.docx"
}

export function DocxViewer({
  className,
  fileName,
  showDownload = true,
  showToolbar = true,
  src,
  buffer,
  toolbarActions,
}: DocxViewerProps) {
  const renderRef = React.useRef<HTMLDivElement>(null)
  const [resolvedBuffer, setResolvedBuffer] = React.useState<ArrayBuffer | null>(
    buffer ?? null
  )
  const [zoom, setZoom] = React.useState(1)
  const [loading, setLoading] = React.useState(!buffer)
  const [rendering, setRendering] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (buffer) {
      setResolvedBuffer(buffer)
      setLoading(false)
      return
    }

    if (!src) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load document (${response.status})`)
        return response.arrayBuffer()
      })
      .then((arrayBuffer) => {
        if (cancelled || !arrayBuffer) return
        setResolvedBuffer(arrayBuffer)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [buffer, src])

  React.useEffect(() => {
    if (!resolvedBuffer) return

    let cancelled = false
    setRendering(true)
    setError(false)

    ;(async () => {
      try {
        const { renderAsync } = await import("docx-preview")
        if (cancelled || !renderRef.current) return
        renderRef.current.innerHTML = ""
        await renderAsync(resolvedBuffer, renderRef.current, undefined, {
          inWrapper: true,
          className: "docx",
          useBase64URL: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
        })
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedBuffer])

  React.useEffect(() => {
    if (!resolvedBuffer) {
      setDownloadUrl(null)
      return
    }

    const url = URL.createObjectURL(new Blob([resolvedBuffer], { type: DOCX_MIME }))
    setDownloadUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [resolvedBuffer])

  const controlsDisabled = loading || rendering || error || !resolvedBuffer
  const zoomPercent = Math.round(zoom * 100)

  return (
    <div
      data-slot="docx-viewer"
      className={cn(
        "flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background",
        className
      )}
    >
      {showToolbar ? (
        <div className="flex min-h-12 flex-wrap items-center justify-end gap-2 border-b bg-background px-3 py-2">
          <TooltipProvider>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
              <div className="flex flex-none items-center gap-1">
                <ToolbarTooltip label="Zoom out">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom out"
                    disabled={controlsDisabled || zoom <= ZOOM_OPTIONS[0]}
                    onClick={() => {
                      const nextZoom = [...ZOOM_OPTIONS]
                        .reverse()
                        .find((option) => option < zoom)

                      setZoom(nextZoom ?? ZOOM_OPTIONS[0])
                    }}
                  >
                    <HugeiconsIcon icon={MinusSignCircleIcon} className="size-4" />
                  </Button>
                </ToolbarTooltip>
                <Select
                  value={String(zoom)}
                  onValueChange={(value) => setZoom(Number(value))}
                  disabled={controlsDisabled}
                >
                  <SelectTrigger size="sm" className="w-[84px] min-w-[84px]">
                    <SelectValue placeholder="Zoom">{zoomPercent}%</SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {ZOOM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {Math.round(option * 100)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ToolbarTooltip label="Zoom in">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom in"
                    disabled={
                      controlsDisabled || zoom >= ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]
                    }
                    onClick={() => {
                      const nextZoom = ZOOM_OPTIONS.find((option) => option > zoom)

                      setZoom(nextZoom ?? ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1])
                    }}
                  >
                    <HugeiconsIcon icon={PlusSignCircleIcon} className="size-4" />
                  </Button>
                </ToolbarTooltip>
              </div>
              {toolbarActions ? (
                <>
                  <Separator orientation="vertical" className="mx-1 h-4 self-center" />
                  {toolbarActions}
                </>
              ) : null}
              {showDownload ? (
                <>
                  <Separator orientation="vertical" className="mx-1 h-4 self-center" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Open document actions"
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        disabled={!downloadUrl}
                        onClick={() => {
                          if (!downloadUrl) return
                          const anchor = document.createElement("a")
                          anchor.href = downloadUrl
                          anchor.download = getDocxDownloadFileName(fileName, src)
                          anchor.rel = "noopener"
                          document.body.append(anchor)
                          anchor.click()
                          anchor.remove()
                        }}
                      >
                        <HugeiconsIcon icon={Download01Icon} className="size-4" />
                        Download
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </div>
          </TooltipProvider>
        </div>
      ) : null}
      <ScrollArea
        className="relative min-h-0 flex-1"
        orientation="both"
        viewportClassName="bg-muted/30"
      >
        {loading || rendering ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-muted/30">
            <Spinner className="size-4" />
          </div>
        ) : null}
        {error ? (
          <div className="grid min-h-full place-items-center p-6 text-sm text-muted-foreground">
            Unable to render this document.
          </div>
        ) : null}
        {!error && resolvedBuffer ? (
          <div
            ref={renderRef}
            className="fpreview-docx min-h-full w-full"
            style={{ zoom: `${zoomPercent}%` }}
          />
        ) : null}
      </ScrollArea>
    </div>
  )
}

export default DocxViewer
