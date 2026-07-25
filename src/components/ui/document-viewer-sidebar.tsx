"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

const INLINE_SIDEBAR_BREAKPOINT = 640

function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = React.useRef<T | null>(null)
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

function useInlineThumbnailSidebar(width: number): boolean {
  return width > 0 && width < INLINE_SIDEBAR_BREAKPOINT
}

function DocumentViewerSidebarSkeleton({
  className,
  inline = false,
}: {
  className?: string
  inline?: boolean
}) {
  return (
    <div
      data-slot="document-viewer-sidebar-skeleton"
      className={cn(
        "h-full shrink-0 overflow-hidden border-r bg-sidebar",
        inline && "absolute inset-y-0 left-0 z-20 shadow-md",
        className
      )}
    >
      <div className="flex h-full flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[3/4] w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}

function DocumentViewerThumbnailSidebar({
  children,
  className,
  closedInlineClassName,
  inline = false,
  open = false,
  widthClassName,
}: {
  children?: React.ReactNode
  className?: string
  closedInlineClassName?: string
  inline?: boolean
  open?: boolean
  widthClassName?: string
}) {
  return (
    <div
      data-slot="document-viewer-thumbnail-sidebar"
      className={cn(
        "h-full shrink-0 overflow-hidden border-r bg-sidebar transition-[margin-left] duration-200 ease-out",
        widthClassName,
        inline && "absolute inset-y-0 left-0 z-20 shadow-md",
        !open && closedInlineClassName,
        className
      )}
    >
      <div className={cn("h-full overflow-hidden", widthClassName)}>
        {children}
      </div>
    </div>
  )
}

export {
  DocumentViewerSidebarSkeleton,
  DocumentViewerThumbnailSidebar,
  useElementWidth,
  useInlineThumbnailSidebar,
}
