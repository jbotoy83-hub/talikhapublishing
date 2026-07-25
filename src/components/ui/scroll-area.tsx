"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  orientation?: "vertical" | "horizontal" | "both"
  scrollFade?: boolean
  viewportClassName?: string
  viewportProps?: React.ComponentProps<"div">
  viewportRef?: React.Ref<HTMLDivElement>
}

function ScrollArea({
  className,
  orientation = "vertical",
  scrollFade = false,
  viewportClassName,
  viewportProps,
  viewportRef,
  children,
  ...props
}: ScrollAreaProps) {
  const showVertical = orientation === "vertical" || orientation === "both"
  const showHorizontal = orientation === "horizontal" || orientation === "both"

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "h-full w-full rounded-[inherit] [&>div]:block!",
          viewportClassName
        )}
        {...viewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVertical ? (
        <ScrollAreaScrollbar orientation="vertical" fade={scrollFade} />
      ) : null}
      {showHorizontal ? (
        <ScrollAreaScrollbar orientation="horizontal" fade={scrollFade} />
      ) : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollAreaScrollbar({
  className,
  orientation = "vertical",
  fade = false,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & {
  fade?: boolean
}) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        fade && "opacity-0 hover:opacity-100 data-[state=visible]:opacity-100",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border transition-colors hover:bg-foreground/30"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea }
