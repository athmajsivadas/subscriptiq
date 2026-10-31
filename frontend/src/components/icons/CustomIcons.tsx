import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const customIconVariants = cva("", {
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

interface CustomIconProps extends VariantProps<typeof customIconVariants> {
  className?: string;
}

export const VerifiedIcon: React.FC<CustomIconProps> = ({ size, color, className }) => (
  <svg 
    className={cn(customIconVariants({ size, color }), className)}
    viewBox="0 0 16 16" 
    fill="none"
  >
    <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M8.158 0.992L8.929 2.61C9.095 2.968 8.959 3.388 8.626 3.59L7.083 4.43L6.781 6.203C6.705 6.592 6.357 6.857 5.979 6.794L4.255 6.53L2.999 7.79C2.727 8.07 2.288 8.07 2.016 7.79L0.76 6.53L-0.979 6.779C-1.357 6.841 -1.72 6.577 -1.781 6.188L-2.083 4.414L-3.626 3.574C-3.959 3.388 -4.095 2.968 -3.929 2.61L-3.158 0.992L-3.929 -0.626C-4.095 -0.983 -3.959 -1.403 -3.626 -1.59L-2.083 -2.445L-1.781 -4.219C-1.705 -4.608 -1.357 -4.872 -0.979 -4.81L0.745 -4.546L2.001 -5.79C2.273 -6.07 2.712 -6.07 2.984 -5.79L4.24 -4.546L5.979 -4.794C6.357 -4.857 6.72 -4.592 6.781 -4.203L7.083 -2.43L8.626 -1.59C8.959 -1.403 9.095 -0.983 8.929 -0.625L8.158 0.992ZM5.524 0.024C5.759 -0.21 5.759 -0.59 5.524 -0.824C5.29 -1.059 4.91 -1.059 4.676 -0.824L1.6 2.251L0.024 0.676C-0.21 0.441 -0.59 0.441 -0.824 0.676C-1.059 0.91 -1.059 1.29 -0.824 1.524L1.176 3.524C1.41 3.759 1.79 3.759 2.024 3.524L5.524 0.024Z" 
      fill="currentColor"
    />
  </svg>
);

export const CheckmarkIcon: React.FC<CustomIconProps> = ({ size, color, className }) => (
  <svg 
    className={cn(customIconVariants({ size, color }), className)}
    viewBox="0 0 16 16" 
    fill="none"
  >
    <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M14.741 2.01C15.066 2.309 15.088 2.815 14.79 3.141L6.39 12.941C6.238 13.106 6.024 13.2 5.8 13.2C5.576 13.2 5.362 13.106 5.21 12.941L1.21 8.759C0.912 8.433 0.934 7.927 1.259 7.628C1.585 7.33 2.091 7.352 2.39 7.678L5.8 11.216L13.61 2.059C13.909 1.734 14.415 1.712 14.741 2.01Z" 
      fill="currentColor"
    />
  </svg>
);

export const StackedDatabaseIcon: React.FC<CustomIconProps> = ({ size, color, className }) => (
  <div className={cn("relative", customIconVariants({ size }), className)}>
    <svg className="w-full h-full text-neutral-300" viewBox="0 0 16 16" fill="none">
      <path d="M12.74 5.167L8.26 2.57C8.1 2.477 7.9 2.477 7.74 2.57L3.26 5.167C3.1 5.26 3 5.432 3 5.617V10.811C3 10.997 3.1 11.169 3.26 11.262L7.74 13.859C7.82 13.905 7.91 13.929 8 13.929C8.09 13.929 8.18 13.906 8.26 13.859L12.74 11.262C12.9 11.169 13 10.997 13 10.811V5.617C13 5.432 12.9 5.26 12.74 5.167ZM8 3.621L11.44 5.617L8 7.614L4.56 5.618L8 3.621ZM8.52 12.507V8.515L11.96 6.519V10.511L8.52 12.507Z" fill="currentColor"/>
    </svg>
    <svg 
      className="absolute inset-0 w-full h-full text-neutral-600"
      style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }}
      viewBox="0 0 16 16" 
      fill="none"
    >
      <path d="M12.74 5.167L8.26 2.57C8.1 2.477 7.9 2.477 7.74 2.57L3.26 5.167C3.1 5.26 3 5.432 3 5.617V10.811C3 10.997 3.1 11.169 3.26 11.262L7.74 13.859C7.82 13.905 7.91 13.929 8 13.929C8.09 13.929 8.18 13.906 8.26 13.859L12.74 11.262C12.9 11.169 13 10.997 13 10.811V5.617C13 5.432 12.9 5.26 12.74 5.167ZM8 3.621L11.44 5.617L8 7.614L4.56 5.618L8 3.621ZM8.52 12.507V8.515L11.96 6.519V10.511L8.52 12.507Z" fill="currentColor"/>
    </svg>
  </div>
);