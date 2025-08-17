import * as React from "react"
import { cn } from "@/lib/utils"
import { Star, Users, Clock, X } from "lucide-react"

interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "gray" | "green" | "red" | "blue" | "live" | "prize"
  icon?: "star" | "users" | "clock" | "close" | React.ReactNode
  children: React.ReactNode
  onClose?: () => void
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant = "gray", icon, children, onClose, ...props }, ref) => {
    const baseClasses = "chip caption"
    
    const variantClasses = {
      gray: "chip-gray",
      green: "chip-green", 
      red: "chip-red",
      blue: "chip-blue",
      live: "live-badge",
      prize: "prize-pill"
    }
    
    const renderIcon = () => {
      if (typeof icon === "string") {
        switch (icon) {
          case "star":
            return <Star className="w-3 h-3 fill-current text-gold" />
          case "users":
            return <Users className="w-3 h-3" />
          case "clock":
            return <Clock className="w-3 h-3" />
          case "close":
            return <X className="w-3 h-3" />
          default:
            return null
        }
      }
      return icon
    }
    
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (onClose) {
        e.preventDefault()
        onClose()
      }
      props.onClick?.(e)
    }
    
    if (variant === "live") {
      return (
        <div
          ref={ref}
          className={cn(baseClasses, variantClasses[variant], className)}
          {...props}
        >
          <div className="live-dot" />
          {children}
        </div>
      )
    }
    
    if (variant === "prize") {
      return (
        <div
          ref={ref}
          className={cn(baseClasses, variantClasses[variant], className)}
          {...props}
        >
          {renderIcon()}
          {children}
        </div>
      )
    }
    
    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        onClick={handleClick}
        {...props}
      >
        {renderIcon()}
        {children}
        {onClose && <X className="w-3 h-3 ml-1 cursor-pointer" />}
      </div>
    )
  }
)
Chip.displayName = "Chip"

export { Chip }