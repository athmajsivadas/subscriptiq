import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const tokenIconVariants = cva(
  "rounded-full flex items-center justify-center font-semibold",
  {
    variants: {
      size: {
        sm: "w-4 h-4 text-xs", // 16px
        md: "w-5 h-5 text-xs", // 20px  
        lg: "w-6 h-6 text-sm", // 24px
      },
      variant: {
        ethereum: "bg-[#627EEA] text-white",
        bitcoin: "bg-[#F7931A] text-white", 
        litecoin: "bg-[#345D9D] text-white",
        solana: "bg-[#8247E5] text-white",
        cardano: "bg-[#2D72D2] text-white",
        polygon: "bg-[#8247E5] text-white",
        binance: "bg-[#F3BA2F] text-black",
        usdc: "bg-[#2775CA] text-white",
        usdt: "bg-[#26A17B] text-white",
        dai: "bg-[#F4B731] text-black",
        chainlink: "bg-[#375BD2] text-white",
        uniswap: "bg-[#FF007A] text-white",
        default: "bg-neutral-100 text-neutral-600",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface TokenIconProps extends VariantProps<typeof tokenIconVariants> {
  symbol: string;
  variant?: "ethereum" | "bitcoin" | "litecoin" | "solana" | "cardano" | "polygon" | "binance" | "usdc" | "usdt" | "dai" | "chainlink" | "uniswap" | "default";
  className?: string;
}

export const TokenIcon: React.FC<TokenIconProps> = ({ 
  symbol, 
  size, 
  variant = "default", 
  className 
}) => {
  const displaySymbol = symbol.slice(0, 2).toUpperCase();
  
  return (
    <div className={cn(tokenIconVariants({ size, variant }), className)}>
      {displaySymbol}
    </div>
  );
};