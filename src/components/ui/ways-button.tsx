import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-98",
  {
    variants: {
      variant: {
        primary: "h-12 px-[18px] py-[14px] text-foreground shadow-lg active:shadow-md",
        secondary: "h-11 px-4 py-3 border border-border bg-transparent text-foreground hover:bg-muted/10",
        connect: "h-8 px-2.5 py-1.5 bg-accent-blue rounded-[10px] text-foreground micro font-medium",
        claim: "h-9 px-3 py-2 border border-border bg-transparent text-foreground rounded-[10px]",
        round: "w-9 h-9 rounded-full bg-chip-gray text-foreground caption hover:bg-muted",
        close: "px-3 py-1.5 bg-chip-gray rounded-[10px] text-foreground caption"
      },
      size: {
        default: "h-12 px-[18px]",
        sm: "h-9 px-3",
        lg: "h-14 px-8"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const WaysButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const baseStyle = variant === "primary" ? {
      background: "var(--grad-cta)",
      boxShadow: "0 8px 16px rgba(124, 73, 255, 0.35)"
    } : {}
    
    const activeStyle = variant === "primary" ? {
      background: "var(--grad-cta-pressed)"
    } : {}
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{ ...baseStyle, ...style }}
        onMouseDown={(e) => {
          if (variant === "primary") {
            e.currentTarget.style.background = "var(--grad-cta-pressed)"
          }
        }}
        onMouseUp={(e) => {
          if (variant === "primary") {
            e.currentTarget.style.background = "var(--grad-cta)"
          }
        }}
        onMouseLeave={(e) => {
          if (variant === "primary") {
            e.currentTarget.style.background = "var(--grad-cta)"
          }
        }}
        {...props}
      />
    )
  }
)
WaysButton.displayName = "WaysButton"

export { WaysButton, buttonVariants }