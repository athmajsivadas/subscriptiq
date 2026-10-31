import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover shadow-sm hover:shadow-md",
        secondary: "bg-muted text-muted-foreground hover:bg-muted-hover active:bg-muted-active border border-border",
        tertiary: "text-primary hover:bg-primary-light-20 active:bg-primary-light",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive shadow-sm",
        outline: "border border-border bg-background text-foreground hover:bg-muted-hover active:bg-muted-hover",
        ghost: "hover:bg-muted-hover active:bg-muted-hover text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 typo-button-small rounded-md [&_svg]:size-3",
        default: "h-10 px-4 typo-button rounded-lg [&_svg]:size-4", 
        lg: "h-12 px-6 typo-button rounded-lg [&_svg]:size-5",
        icon: "h-10 w-10 rounded-lg [&_svg]:size-4",
        "icon-sm": "h-8 w-8 rounded-md [&_svg]:size-3",
        "icon-lg": "h-12 w-12 rounded-lg [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
