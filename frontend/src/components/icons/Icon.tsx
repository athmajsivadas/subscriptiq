import * as React from "react";
import { LucideIcon, icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const iconVariants = cva("", {
  variants: {
    size: {
      sm: "w-4 h-4", // 16px
      md: "w-5 h-5", // 20px  
      lg: "w-6 h-6", // 24px
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      secondary: "text-secondary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      neutral: "text-neutral-500",
    },
  },
  defaultVariants: {
    size: "md",
    color: "default",
  },
});

export interface IconProps extends VariantProps<typeof iconVariants> {
  name: keyof typeof icons;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size, color, className }) => {
  const LucideIcon = icons[name] as LucideIcon;
  
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in Lucide icons`);
    return null;
  }

  return <LucideIcon className={cn(iconVariants({ size, color }), className)} />;
};