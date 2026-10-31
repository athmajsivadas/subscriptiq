import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FinancialSidebar } from "./FinancialSidebar";
import { NotificationPopover } from "./NotificationPopover";
import { SearchResults } from "./SearchResults";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Fuel, Wallet, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef } from "react";
import { useGlobalSearch, SearchResult } from "@/hooks/useGlobalSearch";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const { results, isLoading } = useGlobalSearch(searchQuery);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        setIsDemoUser(user.email === "demo@financeflow.app");
      }
    };
    getUser();
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(value.trim().length >= 2);
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");

    // Navigate based on result type with specific item IDs
    switch (result.type) {
      case 'invoice':
        navigate(`/receivables?invoiceId=${result.id}`);
        break;
      case 'payment':
        navigate(`/receivables?paymentId=${result.id}`);
        break;
      case 'customer':
        navigate(`/receivables?customerId=${result.id}`);
        break;
      case 'contact':
        // Navigate to overview with contact highlighted
        toast({
          title: "Contact Found",
          description: `${result.title} - ${result.subtitle}`,
        });
        navigate('/');
        break;
    }
  };

  const handleSignOut = async () => {
    // Reset demo data if this is the demo user
    if (isDemoUser) {
      try {
        const { error: resetError } = await supabase.rpc('reset_demo_data');
        if (resetError) {
          console.error('Error resetting demo data:', resetError);
        }
      } catch (error) {
        console.error('Error resetting demo data:', error);
      }
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: isDemoUser 
          ? "Demo data has been reset. Next time you log in, you'll start fresh." 
          : "You have been logged out of FinanceFlow.",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <FinancialSidebar />
        
        <div className="flex-1 flex flex-col overflow-visible">
          {/* Header */}
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-50 overflow-visible">
            <div className="flex items-center gap-4 flex-1 overflow-visible relative">
              <SidebarTrigger className="lg:hidden" />
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-2xl z-50" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input
                  placeholder="Search for transactions, accounts and anything else financial"
                  className="pl-10 bg-muted-50 border-none"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.trim().length >= 2 && setShowResults(true)}
                />
                {showResults && (
                  <SearchResults results={results} onResultClick={handleResultClick} />
                )}
                {isLoading && searchQuery.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-card rounded-md shadow-2xl z-[9999] border border-border">
                    <p className="text-sm text-muted-foreground text-center">Searching...</p>
                  </div>
                )}
              </div>
              
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <NotificationPopover />
              
              {/* Action Buttons */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className="bg-secondary text-secondary-foreground hover:bg-secondary-hover-90"
                    onClick={() => {
                      toast({
                        title: "Coming Soon",
                        description: "Bank account connection feature is under development.",
                      });
                    }}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Account
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming Soon</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Logout Button */}
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                {isDemoUser ? "Exit Demo" : "Log Out"}
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 bg-background overflow-auto relative z-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}