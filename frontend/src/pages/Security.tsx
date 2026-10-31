import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Key, AlertTriangle, CheckCircle } from "lucide-react";
import { FilterHeader, FilterState } from "@/components/FilterHeader";
import { FilterSegmentsSettings } from "@/components/FilterSegmentsSettings";

const Security = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    currency: 'USD'
  });
  const securityFeatures = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "All your financial data is encrypted in transit and at rest",
      status: "active",
    },
    {
      icon: Lock,
      title: "Two-Factor Authentication",
      description: "Additional security layer for your account access",
      status: "active",
    },
    {
      icon: Eye,
      title: "Privacy Controls",
      description: "Control who can access your financial information",
      status: "active",
    },
    {
      icon: Key,
      title: "API Security",
      description: "Secure API keys management for connected services",
      status: "active",
    },
  ];

  const securityStats = [
    { label: "Security Score", value: "95%", status: "good" },
    { label: "Last Security Scan", value: "2 hours ago", status: "good" },
    { label: "Vulnerabilities", value: "0", status: "good" },
    { label: "Connected Apps", value: "3", status: "warning" },
  ];

  return (
    <div className="space-y-0">
      <FilterHeader 
        filters={filters}
        onFiltersChange={setFilters}
        showFxCurrency={false}
      />
      
      <div className="space-y-6 p-4">
      <div>
        <h1 className="text-3xl tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Monitor and manage your account security settings
        </p>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {securityStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              {stat.status === "good" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle>Security Features</CardTitle>
          <CardDescription>
            Your account is protected by these security measures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {securityFeatures.map((feature) => (
              <div key={feature.title} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                    <feature.icon className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm text-foreground">
                      {feature.title}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter Segments Settings */}
      <FilterSegmentsSettings />

      {/* Recent Security Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
          <CardDescription>
            Latest security events and login activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Successful login from new device
                </p>
                <p className="text-sm text-muted-foreground">
                  MacBook Pro • 2 hours ago
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Password changed successfully
                </p>
                <p className="text-sm text-muted-foreground">
                  Yesterday at 3:45 PM
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Two-factor authentication enabled
                </p>
                <p className="text-sm text-muted-foreground">
                  3 days ago
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Security;