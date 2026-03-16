"use client"

import * as React from "react"
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

// ── Shared state ──────────────────────────────────────────────────

interface ContextMenuState {
  open: boolean
  setOpen: (open: boolean) => void
  anchorPoint: { x: number; y: number }
  setAnchorPoint: (point: { x: number; y: number }) => void
}

const ContextMenuContext = createContext<ContextMenuState | null>(null)

function useContextMenuState(): ContextMenuState {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error("useContextMenuState must be used inside <ContextMenu>")
  return ctx
}

// ── Components ────────────────────────────────────────────────────

function ContextMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 })

  const value = useMemo(
    () => ({ open, setOpen, anchorPoint, setAnchorPoint }),
    [open, anchorPoint],
  )

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  )
}

function ContextMenuTrigger({
  children,
  className,
  filter,
  ...props
}: React.ComponentProps<"div"> & {
  /** Return true to open the menu, false to let the default context menu show. */
  filter?: (target: HTMLElement) => boolean
}) {
  const { setOpen, setAnchorPoint } = useContextMenuState()

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (filter && !filter(e.target as HTMLElement)) return
      e.preventDefault()
      setAnchorPoint({ x: e.clientX, y: e.clientY })
      setOpen(true)
    },
    [setOpen, setAnchorPoint, filter],
  )

  return (
    <div onContextMenu={handleContextMenu} className={className} {...props}>
      {children}
    </div>
  )
}

function ContextMenuContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open, setOpen, anchorPoint } = useContextMenuState()

  const virtualAnchorRef = useRef({
    getBoundingClientRect: () => ({
      x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0,
      toJSON() { return this },
    }),
  })

  // Update the virtual anchor position whenever anchorPoint changes
  virtualAnchorRef.current = {
    getBoundingClientRect: () => ({
      x: anchorPoint.x,
      y: anchorPoint.y,
      top: anchorPoint.y,
      left: anchorPoint.x,
      bottom: anchorPoint.y,
      right: anchorPoint.x,
      width: 0,
      height: 0,
      toJSON() { return this },
    }),
  }

  return (
    <MenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          className="isolate z-50 outline-none"
          anchor={virtualAnchorRef.current}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <MenuPrimitive.Popup
            data-slot="context-menu-content"
            className={cn(
              "z-50 min-w-40 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className,
            )}
          >
            {children}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

function ContextMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
}
