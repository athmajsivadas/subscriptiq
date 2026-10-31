import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownLeft, Send, Repeat, ShoppingCart, Plus, ExternalLink, CheckCircle, Clock, Bell, User, Check } from "lucide-react";
import WalletIcon from "@/assets/wallet-icon.svg";
import SellIcon from "@/assets/sell-icon.svg";
import SendIcon from "@/assets/send-icon.svg";
import ReceiveIcon from "@/assets/receive-icon.svg";
import SwapIcon from "@/assets/swap-icon.svg";
import { useFinancialMetrics, useRevenueSources, useExpenseCategories, useKPIs, formatCurrency, formatPercentage } from "@/hooks/useFinancialData";
import { useRevenueProfitData } from "@/hooks/useRevenueProfitData";
import { useRevenueDrillDown } from "@/hooks/useRevenueDrillDown";
import { RevenueDrillDownTable } from "@/components/RevenueDrillDownTable";
import { RevenueProfitChart } from "@/components/RevenueProfitChart";
import { useState } from "react";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useContacts } from "@/hooks/useContacts";
import { ContactAvatar } from "@/components/ContactAvatar";
import { ContactsDialog } from "@/components/ContactsDialog";
import { NotificationSettingsDialog } from "@/components/NotificationSettingsDialog";
import { toast } from "sonner";
import { TimePeriodSelector, TimePeriod } from "@/components/TimePeriodSelector";
import { usePeriodComparison } from "@/hooks/usePeriodComparison";

export default function Overview() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [filters] = useState<{ currency: string; dateRange?: { from?: Date; to?: Date } }>({ 
    currency: "USD",
    dateRange: undefined 
  });
  const { convertAmount, currencySymbol } = useCurrencyConversion(filters.currency);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const { contacts, isLoading: contactsLoading } = useContacts();
  
  // Drill-down state for Revenue/Profit chart
  const [drillDownParams, setDrillDownParams] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  
  const { data: drillDownData, isLoading: drillDownLoading } = useRevenueDrillDown(drillDownParams);

  const {
    data: metrics,
    isLoading: metricsLoading
  } = useFinancialMetrics(filters.dateRange);
  const {
    data: revenueSources,
    isLoading: revenueLoading
  } = useRevenueSources();
  const {
    data: expenseCategories,
    isLoading: expensesLoading
  } = useExpenseCategories();
  const {
    data: kpis,
    isLoading: kpisLoading
  } = useKPIs();
  const {
    data: revenueProfitData,
    isLoading: revenueProfitLoading
  } = useRevenueProfitData(filters.dateRange);
  
  const {
    data: periodComparison,
    isLoading: comparisonLoading
  } = usePeriodComparison(selectedPeriod);

  const formatWithCurrency = (amount: number) => {
    const converted = convertAmount(amount);
    return `${currencySymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper function to get metric by type
  const getMetric = (type: string) => {
    return metrics?.find(m => m.metric_type === type);
  };

  // Helper function to get KPI by name
  const getKPI = (name: string) => {
    return kpis?.find(k => k.kpi_name === name);
  };
  
  // Handle chart point click for drill-down
  const handleChartPointClick = (dateKey: string) => {
    // Determine the date range based on the dateKey format
    let startDate: string;
    let endDate: string;
    
    if (dateKey.length === 7) {
      // Monthly format (YYYY-MM)
      const [year, month] = dateKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Daily format (YYYY-MM-DD)
      startDate = dateKey;
      endDate = dateKey;
    }
    
    setDrillDownParams({ startDate, endDate });
  };
  
  const closeDrillDown = () => {
    setDrillDownParams(null);
  };
  if (metricsLoading || revenueLoading || expensesLoading || kpisLoading || revenueProfitLoading || comparisonLoading) {
    return <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading financial data...</p>
        </div>
      </div>;
  }
  
  const formatGrowth = (growth: number | undefined) => {
    if (growth === undefined || !isFinite(growth)) return "0.0%";
    const sign = growth >= 0 ? "+" : "";
    return `${sign}${growth.toFixed(1)}%`;
  };
  const revenue = getMetric('revenue');
  const expenses = getMetric('expenses');
  const profit = getMetric('profit');
  const cashFlow = getMetric('cash_flow');
  const activeCustomers = getKPI('Active Customers');
  const totalOrders = getKPI('Total Orders');
  const conversionRate = getKPI('Conversion Rate');
  return <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-4 md:space-y-6">
        {/* Period Selector */}
        <div className="flex justify-end">
          <TimePeriodSelector 
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>

        {/* Hero Card - Total Financial Assets */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 rounded-xl md:rounded-2xl p-6 md:p-8 text-primary-foreground">
          <div className="relative z-10">
            <h2 className="text-base md:text-lg mb-2 opacity-90">Total Financial Assets</h2>
            <div className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              {profit || revenue ? formatWithCurrency((profit?.amount || 0) + (revenue?.amount || 0)) : (
                <Badge variant="secondary" className="text-lg px-4 py-2">No Data</Badge>
              )}
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute right-4 md:right-8 top-4 md:top-8 opacity-20">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-background rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8" />
            </div>
          </div>
          <div className="absolute right-8 md:right-16 bottom-4 md:bottom-8 opacity-10">
            <div className="w-8 h-8 md:w-12 md:h-12 bg-background rounded-full" />
          </div>
        </div>

        {/* Key Metrics with Growth Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Revenue */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm text-muted-foreground mb-1">Revenue</h3>
            <div className="text-xl md:text-2xl font-bold mb-2">
              {periodComparison ? formatWithCurrency(periodComparison.current.revenue) : (
                <Badge variant="secondary" className="text-xs">No Data</Badge>
              )}
            </div>
            {periodComparison && (
              <div className={`flex items-center gap-1 text-xs md:text-sm ${
                periodComparison.growth.revenue >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {periodComparison.growth.revenue >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 md:w-4 md:h-4" />
                )}
                <span className="font-medium">{formatGrowth(periodComparison.growth.revenue)}</span>
                <span className="text-muted-foreground hidden sm:inline">vs last {selectedPeriod}</span>
              </div>
            )}
          </Card>

          {/* Expenses */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm text-muted-foreground mb-1">Expenses</h3>
            <div className="text-xl md:text-2xl font-bold mb-2">
              {periodComparison ? formatWithCurrency(periodComparison.current.expenses) : (
                <Badge variant="secondary" className="text-xs">No Data</Badge>
              )}
            </div>
            {periodComparison && (
              <div className={`flex items-center gap-1 text-xs md:text-sm ${
                periodComparison.growth.expenses >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {periodComparison.growth.expenses >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 md:w-4 md:h-4" />
                )}
                <span className="font-medium">{formatGrowth(periodComparison.growth.expenses)}</span>
                <span className="text-muted-foreground hidden sm:inline">vs last {selectedPeriod}</span>
              </div>
            )}
          </Card>

          {/* Profit */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary-light rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm text-muted-foreground mb-1">Profit</h3>
            <div className="text-xl md:text-2xl font-bold mb-2">
              {periodComparison ? formatWithCurrency(periodComparison.current.profit) : (
                <Badge variant="secondary" className="text-xs">No Data</Badge>
              )}
            </div>
            {periodComparison && (
              <div className={`flex items-center gap-1 text-xs md:text-sm ${
                periodComparison.growth.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {periodComparison.growth.profit >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 md:w-4 md:h-4" />
                )}
                <span className="font-medium">{formatGrowth(periodComparison.growth.profit)}</span>
                <span className="text-muted-foreground hidden sm:inline">vs last {selectedPeriod}</span>
              </div>
            )}
          </Card>

          {/* Cash Flow */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-secondary-light rounded-lg flex items-center justify-center">
                <Repeat className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm text-muted-foreground mb-1">Cash Flow</h3>
            <div className="text-xl md:text-2xl font-bold mb-2">
              {periodComparison ? formatWithCurrency(periodComparison.current.cashFlow) : (
                <Badge variant="secondary" className="text-xs">No Data</Badge>
              )}
            </div>
            {periodComparison && (
              <div className={`flex items-center gap-1 text-xs md:text-sm ${
                periodComparison.growth.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {periodComparison.growth.cashFlow >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 md:w-4 md:h-4" />
                )}
                <span className="font-medium">{formatGrowth(periodComparison.growth.cashFlow)}</span>
                <span className="text-muted-foreground hidden sm:inline">vs last {selectedPeriod}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Widgets Section */}
        <Card className="p-4 md:p-6">
          <h3 className="text-base md:text-lg mb-3 md:mb-4">Widgets</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 md:gap-6">
            <div 
              className="flex flex-col items-center gap-2 md:gap-3 cursor-pointer group"
              onClick={() => toast.info("Buy feature coming soon!")}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary-light rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={WalletIcon} alt="Wallet" className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Buy</span>
            </div>
            <div 
              className="flex flex-col items-center gap-2 md:gap-3 cursor-pointer group"
              onClick={() => toast.info("Sell feature coming soon!")}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary-light rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={SellIcon} alt="Sell" className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Sell</span>
            </div>
            <div 
              className="flex flex-col items-center gap-2 md:gap-3 cursor-pointer group"
              onClick={() => toast.info("Send feature coming soon!")}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-light rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={SendIcon} alt="Send" className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Send</span>
            </div>
            <div 
              className="flex flex-col items-center gap-2 md:gap-3 cursor-pointer group"
              onClick={() => toast.info("Receive feature coming soon!")}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={ReceiveIcon} alt="Receive" className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Receive</span>
            </div>
            <div 
              className="flex flex-col items-center gap-2 md:gap-3 cursor-pointer group col-span-3 sm:col-span-1"
              onClick={() => toast.info("Swap feature coming soon!")}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-light-5 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={SwapIcon} alt="Swap" className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Swap</span>
            </div>
          </div>
        </Card>

        <div className="gap-4 md:gap-6">
          {/* Account Balances */}
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-base md:text-lg">Account Balances</h3>
            </div>
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-primary-light rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-primary rounded-full" />
                  </div>
                  <span className="text-sm md:text-base font-medium">Main Account</span>
                </div>
                <div className="text-right">
                  <div className="text-sm md:text-base font-semibold">
                    {revenue ? formatWithCurrency(revenue.amount) : <Badge variant="secondary" className="text-xs">No Data</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{filters.currency}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-secondary-light rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-secondary rounded-full" />
                  </div>
                  <span className="text-sm md:text-base font-medium">Savings</span>
                </div>
                <div className="text-right">
                  <div className="text-sm md:text-base font-semibold">
                    {cashFlow ? formatWithCurrency(Math.abs(cashFlow.amount || 0)) : <Badge variant="secondary" className="text-xs">No Data</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{filters.currency}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-teal-100 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-teal-500 rounded-full" />
                  </div>
                  <span className="text-sm md:text-base font-medium">Investment</span>
                </div>
                <div className="text-right">
                  <div className="text-sm md:text-base font-semibold">
                    {profit ? formatWithCurrency(profit.amount) : <Badge variant="secondary" className="text-xs">No Data</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{filters.currency}</div>
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* Revenue vs Profit Chart */}
        <RevenueProfitChart
          data={revenueProfitData || []}
          formatCurrency={formatWithCurrency}
          onPointClick={handleChartPointClick}
        />
        
        {/* Drill-down table */}
        {drillDownParams && (
          <RevenueDrillDownTable
            data={drillDownData || []}
            title={`Transactions - ${drillDownParams.startDate}${
              drillDownParams.endDate !== drillDownParams.startDate ? ` to ${drillDownParams.endDate}` : ""
            }`}
            onClose={closeDrillDown}
            isLoading={drillDownLoading}
          />
        )}

        {/* Latest Transactions */}
        <Card className="p-4 md:p-6">
          <h3 className="text-base md:text-lg mb-3 md:mb-4">Latest Transactions</h3>
          <div className="flex items-center justify-center py-6 md:py-8">
            <Badge variant="secondary" className="text-xs md:text-sm">No Data</Badge>
          </div>
        </Card>

        {/* Contacts & Address Book - Mobile/Tablet version */}
        <Card 
          className="p-4 md:p-6 cursor-pointer hover:shadow-md transition-shadow lg:hidden"
          onClick={() => setContactsDialogOpen(true)}
        >
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-lg">Contacts & Address Book</h3>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </div>
          {contactsLoading ? (
            <div className="flex items-center justify-center py-3 md:py-4">
              <div className="text-xs md:text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 md:py-4 text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-3">No contacts yet</p>
              <Button variant="outline" size="sm" onClick={(e) => {
                e.stopPropagation();
                setContactsDialogOpen(true);
              }}>
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="text-xs md:text-sm">Add your first contact</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              <div 
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setContactsDialogOpen(true);
                }}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-muted rounded-xl flex items-center justify-center hover:bg-muted-hover transition-colors">
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Add</span>
              </div>
              {contacts.slice(0, 4).map((contact) => (
                <div 
                  key={contact.id} 
                  className="flex flex-col items-center gap-1"
                >
                  <ContactAvatar
                    name={contact.name}
                    color={contact.avatar_color}
                    className="w-8 h-8 md:w-10 md:h-10"
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                    {contact.name.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right Sidebar - Desktop only */}
      <div className="w-80 space-y-4 md:space-y-6 hidden lg:block">
        {/* Real-time Notifications */}
        <Card className="p-4 md:p-6">
          <h3 className="text-base md:text-lg mb-2">Real-time notifications</h3>
          <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
            Protect your accounts & finances with FinanceFlow's email & alerts notifications of all your financial transactions.
          </p>
          <Button className="w-full text-xs md:text-sm" onClick={() => setNotificationDialogOpen(true)}>
            Set up Notifications
            <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 ml-2" />
          </Button>
        </Card>


        {/* Contacts & Address Book (Right Sidebar) */}
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setContactsDialogOpen(true)}
        >
          <h4 className="text-base md:text-lg mb-3">Contacts & Address Book</h4>
          {contactsLoading ? (
            <div className="flex items-center justify-center py-3 md:py-4">
              <div className="text-xs md:text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 md:py-4 text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-3">No contacts yet</p>
              <Button variant="outline" size="sm" onClick={(e) => {
                e.stopPropagation();
                setContactsDialogOpen(true);
              }}>
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="text-xs md:text-sm">Add Contact</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <div 
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setContactsDialogOpen(true);
                }}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-muted rounded-xl flex items-center justify-center hover:bg-muted-hover transition-colors">
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Add</span>
              </div>
              {contacts.slice(0, 5).map((contact) => (
                <div 
                  key={contact.id} 
                  className="flex flex-col items-center gap-1"
                >
                  <ContactAvatar
                    name={contact.name}
                    color={contact.avatar_color}
                    className="w-8 h-8 md:w-10 md:h-10"
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                    {contact.name.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ContactsDialog 
        open={contactsDialogOpen}
        onOpenChange={setContactsDialogOpen}
      />
      <NotificationSettingsDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
      />
    </div>;
}